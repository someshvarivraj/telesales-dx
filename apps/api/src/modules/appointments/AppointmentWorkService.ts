import type { meetingResultRequestSchema } from '@telesales/shared';
import {
  type AppointmentDetail,
  AppointmentStatus,
  type ChangeRequestDto,
  type DayBeforeCheckRequest,
  formatJstDateTime,
  isTelemaSource,
  NoticeCode,
} from '@telesales/shared';
import type { z } from 'zod';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { AccessPolicy, Actor } from '../../domain/access/AccessPolicy.js';
import type { Clock } from '../../domain/Clock.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { ForbiddenError, InvalidStateError, NotFoundError } from '../../http/errors/AppError.js';
import { toDbDate, userRefSelect } from '../../http/mappers.js';
import type { FileService, UploadedFile } from '../files/FileService.js';
import type { NotificationService } from '../notifications/NotificationService.js';
import { toChangeRequestDto } from './appointmentMapping.js';
import { type AppointmentQueryService, factsOf } from './AppointmentQueryService.js';

type MeetingResultCommand = z.output<typeof meetingResultRequestSchema>;

/**
 * Work on one appointment after it is booked: the rep's confirmation, meeting link,
 * preparation, meeting result and next action, change requests and day-before checks.
 * Everything hangs off the same appointment in time order (spec §2-2).
 */
export class AppointmentWorkService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly policy: AccessPolicy,
    private readonly queries: AppointmentQueryService,
    private readonly files: FileService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditLogger,
    private readonly clock: Clock,
  ) {}

  async confirm(actor: Actor, id: string): Promise<AppointmentDetail> {
    const row = await this.queries.loadRow(id);
    if (!this.policy.abilitiesFor(actor, factsOf(row)).confirm) {
      throw new ForbiddenError();
    }
    if (!row.salesConfirmedAt) {
      await this.prisma.appointment.update({
        where: { id },
        data: { salesConfirmedAt: this.clock.now() },
      });
      await this.audit.record({
        action: AuditAction.AppointmentConfirmed,
        actorUserId: actor.id,
        targetType: 'appointment',
        targetId: id,
      });
    }
    return this.queries.detail(actor, id);
  }

  async setMeetingUrl(
    actor: Actor,
    id: string,
    meetingUrl: string | null,
  ): Promise<AppointmentDetail> {
    const row = await this.queries.loadRow(id);
    if (!this.policy.abilitiesFor(actor, factsOf(row)).editMeetingUrl) {
      throw new ForbiddenError();
    }
    await this.prisma.appointment.update({ where: { id }, data: { meetingUrl } });
    await this.audit.record({
      action: AuditAction.AppointmentUpdated,
      actorUserId: actor.id,
      targetType: 'appointment',
      targetId: id,
      before: { meetingUrl: row.meetingUrl },
      after: { meetingUrl },
    });
    return this.queries.detail(actor, id);
  }

  /** Notes and files; later the place for AI-generated materials (spec §2-6). */
  async addPreparation(
    actor: Actor,
    id: string,
    note: string | null,
    uploads: UploadedFile[],
  ): Promise<AppointmentDetail> {
    const row = await this.queries.loadRow(id);
    if (!this.policy.abilitiesFor(actor, factsOf(row)).addPreparation) {
      throw new ForbiddenError();
    }
    if (!note && uploads.length === 0) {
      throw new InvalidStateError({ reason: 'empty' });
    }
    const stored = [];
    for (const upload of uploads) {
      stored.push(await this.files.store(upload, actor.id));
    }
    const preparation = await this.prisma.appointmentPreparation.create({
      data: {
        appointmentId: id,
        authorId: actor.id,
        note,
        attachments: { create: stored.map((file) => ({ fileId: file.id })) },
      },
    });
    await this.audit.record({
      action: AuditAction.PreparationAdded,
      actorUserId: actor.id,
      targetType: 'appointment',
      targetId: id,
      after: {
        preparationId: preparation.id,
        note,
        files: stored.map((file) => file.originalName),
      },
    });
    return this.queries.detail(actor, id);
  }

  /** Can this user download a file attached to the appointment? Everyone involved can view. */
  async preparationFile(id: string, fileId: string) {
    const attachment = await this.prisma.preparationAttachment.findFirst({
      where: { fileId, preparation: { appointmentId: id } },
    });
    const sourceFile = await this.prisma.appointmentSourceFile.findFirst({
      where: { appointmentId: id, fileId },
      select: { id: true },
    });
    if (!attachment && !sourceFile) {
      throw new NotFoundError();
    }
    return this.files.read(fileId);
  }

  /** Sales enter the meeting result and the next action (spec §2-4); the booker and viewers are told (N16). */
  async addResult(
    actor: Actor,
    id: string,
    command: MeetingResultCommand,
  ): Promise<AppointmentDetail> {
    const row = await this.queries.loadRow(id);
    if (!this.policy.abilitiesFor(actor, factsOf(row)).addResult) {
      throw new ForbiddenError();
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.meetingResult.create({
        data: {
          appointmentId: id,
          authorId: actor.id,
          visitedOn: toDbDate(command.visitedOn),
          attendee: command.attendee,
          discussion: command.discussion,
          response: command.response,
          dealStatus: command.dealStatus,
          nextAction: command.nextAction,
          nextActionDate: command.nextActionDate ? toDbDate(command.nextActionDate) : null,
        },
      });
      if (row.status === AppointmentStatus.Scheduled) {
        await tx.appointment.update({
          where: { id },
          data: { status: AppointmentStatus.Completed, version: { increment: 1 } },
        });
      }
      return created;
    });
    await this.audit.record({
      action: AuditAction.MeetingResultAdded,
      actorUserId: actor.id,
      targetType: 'appointment',
      targetId: id,
      after: { resultId: result.id, ...command },
    });
    await this.notifications.notify({
      code: NoticeCode.MeetingResultPosted,
      title: `打ち合わせ結果が入りました：${row.company.name}`,
      body: command.nextAction ? `次回アクション：${command.nextAction}` : undefined,
      linkPath: `/appointments/${id}`,
      actorId: actor.id,
      context: { BOOKER: [row.bookedById] },
    });
    return this.queries.detail(actor, id);
  }

  /** Sales cannot change a telemarketing appointment; they ask, and all telemarketers are told (N7). */
  async requestChange(actor: Actor, id: string, message: string): Promise<AppointmentDetail> {
    const row = await this.queries.loadRow(id);
    if (!this.policy.abilitiesFor(actor, factsOf(row)).requestChange) {
      throw new ForbiddenError();
    }
    const request = await this.prisma.changeRequest.create({
      data: { appointmentId: id, requestedById: actor.id, message },
    });
    await this.audit.record({
      action: AuditAction.ChangeRequestUpdated,
      actorUserId: actor.id,
      targetType: 'change_request',
      targetId: request.id,
      after: { appointmentId: id, status: request.status, message },
    });
    await this.notifications.notify({
      code: NoticeCode.ChangeRequested,
      title: `変更依頼：${row.company.name}（${formatJstDateTime(row.startsAt)}）`,
      body: message,
      linkPath: `/appointments/change-requests`,
      actorId: actor.id,
    });
    return this.queries.detail(actor, id);
  }

  /** 「対応する」: one telemarketer takes the request; the status is visible to sales. */
  async takeChangeRequest(actor: Actor, requestId: string): Promise<ChangeRequestDto> {
    const request = await this.prisma.changeRequest.findUnique({
      where: { id: requestId },
      include: { appointment: { select: { source: true } } },
    });
    if (!request || !isTelemaSource(request.appointment.source)) {
      throw new NotFoundError();
    }
    const result = await this.prisma.changeRequest.updateMany({
      where: { id: requestId, status: 'REQUESTED' },
      data: { status: 'IN_PROGRESS', handlerId: actor.id, takenAt: this.clock.now() },
    });
    if (result.count === 0) {
      throw new InvalidStateError({ reason: 'already_taken' });
    }
    return this.changeRequestAudit(actor, requestId, request.status);
  }

  /** Done without a time change (e.g. only the details changed). */
  async completeChangeRequest(actor: Actor, requestId: string): Promise<ChangeRequestDto> {
    const request = await this.prisma.changeRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundError();
    }
    const result = await this.prisma.changeRequest.updateMany({
      where: { id: requestId, status: { in: ['REQUESTED', 'IN_PROGRESS'] } },
      data: { status: 'DONE', handlerId: request.handlerId ?? actor.id, doneAt: this.clock.now() },
    });
    if (result.count === 0) {
      throw new InvalidStateError({ reason: 'already_done' });
    }
    await this.notifications.notifyUsers([request.requestedById], {
      code: NoticeCode.ChangeRequested,
      title: '変更依頼に対応しました',
      linkPath: `/appointments/${request.appointmentId}`,
      actorId: actor.id,
    });
    return this.changeRequestAudit(actor, requestId, request.status);
  }

  async withdrawChangeRequest(actor: Actor, requestId: string): Promise<ChangeRequestDto> {
    const request = await this.prisma.changeRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundError();
    }
    if (request.requestedById !== actor.id && !this.policy.isAdmin(actor)) {
      throw new ForbiddenError();
    }
    const result = await this.prisma.changeRequest.updateMany({
      where: { id: requestId, status: 'REQUESTED' },
      data: { status: 'WITHDRAWN' },
    });
    if (result.count === 0) {
      throw new InvalidStateError({ reason: 'already_taken' });
    }
    return this.changeRequestAudit(actor, requestId, request.status);
  }

  /** Confirmed / not reached / changed, and who checked (spec §7). */
  async recordDayBefore(
    actor: Actor,
    id: string,
    command: DayBeforeCheckRequest,
  ): Promise<AppointmentDetail> {
    const row = await this.queries.loadRow(id);
    if (!this.policy.abilitiesFor(actor, factsOf(row)).dayBeforeCheck) {
      throw new ForbiddenError();
    }
    await this.prisma.appointment.update({
      where: { id },
      data: {
        dayBeforeResult: command.result,
        dayBeforeCheckedById: actor.id,
        dayBeforeCheckedAt: this.clock.now(),
      },
    });
    await this.audit.record({
      action: AuditAction.DayBeforeChecked,
      actorUserId: actor.id,
      targetType: 'appointment',
      targetId: id,
      before: { dayBeforeResult: row.dayBeforeResult },
      after: { dayBeforeResult: command.result },
    });
    return this.queries.detail(actor, id);
  }

  private async changeRequestAudit(
    actor: Actor,
    requestId: string,
    beforeStatus: string,
  ): Promise<ChangeRequestDto> {
    const row = await this.prisma.changeRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { requestedBy: userRefSelect, handler: userRefSelect },
    });
    await this.audit.record({
      action: AuditAction.ChangeRequestUpdated,
      actorUserId: actor.id,
      targetType: 'change_request',
      targetId: requestId,
      before: { status: beforeStatus },
      after: { status: row.status },
    });
    return toChangeRequestDto(row);
  }
}
