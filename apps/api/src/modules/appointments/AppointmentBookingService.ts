import { createHash } from 'node:crypto';
import type { updateAppointmentDetailsRequestSchema } from '@telesales/shared';
import {
  APP_KEY,
  APPOINTMENT_PLAN_TYPE,
  type AppointmentDetail,
  AppointmentSource,
  AppointmentStatus,
  type CancelAppointmentRequest,
  type CreateAppointmentCommand,
  formatJstDateTime,
  MeetingFormat,
  NoticeCode,
  phoneDigitsOf,
  type RescheduleRequest,
  Role,
} from '@telesales/shared';
import type { z } from 'zod';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { AccessPolicy, Actor } from '../../domain/access/AccessPolicy.js';
import { normalizeCompanyName } from '../../domain/companies/duplicates.js';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import {
  DuplicateFileError,
  ForbiddenError,
  InvalidStateError,
  NotFoundError,
  SlotUnavailableError,
  ValidationError,
  VersionConflictError,
} from '../../http/errors/AppError.js';
import { iso } from '../../http/mappers.js';
import { companyWriteData } from '../companies/CompanyService.js';
import type { NotificationService } from '../notifications/NotificationService.js';
import type { SlotGuard } from '../schedule/SlotGuard.js';
import type { AppointmentQueryService } from './AppointmentQueryService.js';
import { factsOf } from './AppointmentQueryService.js';

type UpdateDetailsCommand = z.output<typeof updateAppointmentDetailsRequestSchema>;

function isExclusionViolation(error: unknown): boolean {
  const text = String(error instanceof Error ? error.message : error);
  return text.includes('schedule_plans_no_overlapping_appointments') || text.includes('23P01');
}

/** Combined content hash of the imported files: the same file(s) never register twice (spec §9-2). */
export function sourceHashOf(fileHashes: string[], rowKey: string | null): string | null {
  if (fileHashes.length === 0) {
    return null;
  }
  return createHash('sha256')
    .update([...fileHashes].sort().join(':'))
    .update(rowKey ?? '')
    .digest('hex');
}

/** Plain JSON for the change history (before/after). */
function snapshot(row: { startsAt: Date; endsAt: Date; salesRep: { id: string; name: string } }) {
  return {
    startsAt: iso(row.startsAt),
    endsAt: iso(row.endsAt),
    salesRep: { id: row.salesRep.id, name: row.salesRep.name },
  };
}

/**
 * Booking and changing appointments. An appointment and its schedule plan are written
 * together inside a per-rep lock; a change moves the same appointment and never creates
 * a new one (spec §5). Only a re-booking after cancellation is a new, linked appointment.
 */
export class AppointmentBookingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly guard: SlotGuard,
    private readonly policy: AccessPolicy,
    private readonly queries: AppointmentQueryService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditLogger,
  ) {}

  async create(actor: Actor, command: CreateAppointmentCommand): Promise<AppointmentDetail> {
    if (!this.policy.canBook(actor, command.source)) {
      throw new ForbiddenError();
    }
    const startsAt = new Date(command.startsAt);
    const endsAt = new Date(command.endsAt);
    await this.assertSalesRep(command.salesRepId);

    const salesBooked = command.source === AppointmentSource.SalesBooked;
    const bookedById = salesBooked ? actor.id : (command.bookedById ?? actor.id);

    let original: { id: string; status: AppointmentStatus } | null = null;
    if (command.originalAppointmentId) {
      original = await this.prisma.appointment.findUnique({
        where: { id: command.originalAppointmentId },
        select: { id: true, status: true },
      });
      if (!original || original.status !== AppointmentStatus.Cancelled) {
        throw new InvalidStateError({ reason: 'original_not_cancelled' });
      }
    }

    const files = command.sourceFileIds.length
      ? await this.prisma.storedFile.findMany({ where: { id: { in: command.sourceFileIds } } })
      : [];
    if (files.length !== command.sourceFileIds.length) {
      throw new NotFoundError();
    }
    const sourceFileHash = sourceHashOf(
      files.map((file) => file.sha256),
      command.sourceRowKey ?? null,
    );
    if (sourceFileHash) {
      const existing = await this.prisma.appointment.findUnique({
        where: { sourceFileHash },
        select: { id: true },
      });
      if (existing) {
        throw new DuplicateFileError({ appointmentId: existing.id });
      }
    }

    let appointmentId: string;
    try {
      appointmentId = await this.prisma.$transaction(async (tx) => {
        await this.guard.lockRep(tx, command.salesRepId);
        const check = await this.guard.check(
          {
            salesRepId: command.salesRepId,
            startsAt,
            endsAt,
            actorId: actor.id,
            kind: 'APPOINTMENT',
          },
          tx,
        );
        if (!check.ok) {
          throw new SlotUnavailableError(check.problems);
        }
        const companyId = await this.resolveCompany(tx, actor, command);
        const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });

        const appointment = await tx.appointment.create({
          data: {
            companyId,
            sourceCallRecordId: command.sourceCallRecordId ?? null,
            salesRepId: command.salesRepId,
            startsAt,
            endsAt,
            format: command.format,
            visitAddress:
              command.visitAddress ??
              (command.format === MeetingFormat.Visit ? company.address : null),
            contactName: command.contactName,
            contactDepartment: command.contactDepartment ?? company.department,
            contactPhone: command.contactPhone,
            contactEmail: command.contactEmail,
            handoverNotes: command.handoverNotes,
            customerType: command.customerType ?? company.customerType,
            isNewAppointment: command.isNewAppointment,
            listName: command.listName ?? company.listName,
            bookedById,
            bookedAt: command.bookedOn
              ? new Date(`${command.bookedOn}T00:00:00+09:00`)
              : new Date(),
            source: command.source,
            originalAppointmentId: original?.id ?? null,
            sourceFileId: files[0]?.id ?? null,
            sourceFileHash,
          },
        });
        await tx.schedulePlan.create({
          data: {
            ownerId: command.salesRepId,
            createdById: actor.id,
            type: APPOINTMENT_PLAN_TYPE[command.format],
            title: company.name,
            startsAt,
            endsAt,
            appointmentId: appointment.id,
          },
        });
        await this.guard.releaseFor(tx, actor.id, command.salesRepId);
        return appointment.id;
      });
    } catch (error) {
      throw this.mapOverlap(error);
    }

    const detail = await this.queries.detail(actor, appointmentId);
    await this.audit.record({
      action: AuditAction.AppointmentCreated,
      actorUserId: actor.id,
      targetType: 'appointment',
      targetId: appointmentId,
      after: {
        companyId: detail.company.id,
        salesRepId: detail.salesRep.id,
        startsAt: detail.startsAt,
        endsAt: detail.endsAt,
        format: detail.format,
        source: detail.source,
        originalAppointmentId: detail.originalAppointmentId,
      },
    });
    await this.notifyBooked(actor, detail);
    return detail;
  }

  async updateDetails(
    actor: Actor,
    id: string,
    command: UpdateDetailsCommand,
  ): Promise<AppointmentDetail> {
    const row = await this.queries.loadRow(id);
    if (!this.policy.abilitiesFor(actor, factsOf(row)).editDetails) {
      throw new ForbiddenError();
    }
    const data = {
      format: command.format,
      visitAddress: command.visitAddress,
      contactName: command.contactName,
      contactDepartment: command.contactDepartment,
      contactPhone: command.contactPhone,
      contactEmail: command.contactEmail,
      handoverNotes: command.handoverNotes,
      customerType: command.customerType,
      listName: command.listName,
      isNewAppointment: command.isNewAppointment,
    };
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.appointment.updateMany({
        where: { id, version: command.expectedVersion },
        data: { ...data, version: { increment: 1 } },
      });
      if (result.count === 0) {
        throw new VersionConflictError();
      }
      // The plan type follows the format (spec §7).
      await tx.schedulePlan.updateMany({
        where: { appointmentId: id },
        data: { type: APPOINTMENT_PLAN_TYPE[command.format] },
      });
    });
    const before = Object.fromEntries(
      Object.keys(data).map((key) => [key, row[key as keyof typeof row] ?? null]),
    );
    await this.audit.record({
      action: AuditAction.AppointmentUpdated,
      actorUserId: actor.id,
      targetType: 'appointment',
      targetId: id,
      before,
      after: data,
    });
    return this.queries.detail(actor, id);
  }

  /** Moves the same appointment (time and/or rep). Reason: our side / customer side (spec §7). */
  async reschedule(
    actor: Actor,
    id: string,
    command: RescheduleRequest,
  ): Promise<AppointmentDetail> {
    const row = await this.queries.loadRow(id);
    if (!this.policy.canReschedule(actor, factsOf(row))) {
      throw new ForbiddenError();
    }
    if (row.version !== command.expectedVersion) {
      throw new VersionConflictError();
    }
    const startsAt = new Date(command.startsAt);
    const endsAt = new Date(command.endsAt);
    if (
      startsAt.getTime() === row.startsAt.getTime() &&
      endsAt.getTime() === row.endsAt.getTime() &&
      command.salesRepId === row.salesRepId
    ) {
      throw new ValidationError({ startsAt: ['unchanged'] });
    }
    await this.assertSalesRep(command.salesRepId);
    const repChanged = command.salesRepId !== row.salesRepId;
    const before = snapshot(row);

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.guard.lockRep(tx, command.salesRepId);
        const check = await this.guard.check(
          {
            salesRepId: command.salesRepId,
            startsAt,
            endsAt,
            actorId: actor.id,
            kind: 'APPOINTMENT',
            appointmentId: id,
          },
          tx,
        );
        if (!check.ok) {
          throw new SlotUnavailableError(check.problems);
        }
        const result = await tx.appointment.updateMany({
          where: { id, version: command.expectedVersion, status: AppointmentStatus.Scheduled },
          data: {
            startsAt,
            endsAt,
            salesRepId: command.salesRepId,
            version: { increment: 1 },
            // A new time needs a new day-before check; a new rep needs to confirm again.
            dayBeforeResult: null,
            dayBeforeCheckedById: null,
            dayBeforeCheckedAt: null,
            ...(repChanged ? { salesConfirmedAt: null } : {}),
          },
        });
        if (result.count === 0) {
          throw new VersionConflictError();
        }
        await tx.schedulePlan.updateMany({
          where: { appointmentId: id },
          data: { startsAt, endsAt, ownerId: command.salesRepId },
        });
        const newRep = await tx.user.findUniqueOrThrow({
          where: { id: command.salesRepId },
          select: { id: true, name: true },
        });
        await tx.appointmentChange.create({
          data: {
            appointmentId: id,
            changedById: actor.id,
            reason: command.reason,
            before,
            after: snapshot({ startsAt, endsAt, salesRep: newRep }),
          },
        });
        if (command.changeRequestId) {
          await tx.changeRequest.updateMany({
            where: {
              id: command.changeRequestId,
              appointmentId: id,
              status: { in: ['REQUESTED', 'IN_PROGRESS'] },
            },
            data: { status: 'DONE', doneAt: new Date(), handlerId: actor.id },
          });
        }
        await this.guard.releaseFor(tx, actor.id, command.salesRepId);
      });
    } catch (error) {
      throw this.mapOverlap(error);
    }

    const detail = await this.queries.detail(actor, id);
    await this.audit.record({
      action: AuditAction.AppointmentRescheduled,
      actorUserId: actor.id,
      targetType: 'appointment',
      targetId: id,
      before,
      after: { startsAt: detail.startsAt, endsAt: detail.endsAt, salesRep: detail.salesRep },
      metadata: { reason: command.reason, changeRequestId: command.changeRequestId ?? null },
    });
    const reasonLabel = command.reason === 'OUR_SIDE' ? 'モ変' : '先変';
    await this.notifications.notify({
      code: NoticeCode.Rescheduled,
      title: `【${reasonLabel}】${detail.company.name}：${formatJstDateTime(row.startsAt)} → ${formatJstDateTime(new Date(detail.startsAt))}`,
      body: repChanged ? `担当営業：${row.salesRep.name} → ${detail.salesRep.name}` : undefined,
      linkPath: `/appointments/${id}`,
      actorId: actor.id,
      context: {
        ASSIGNED_REP: [detail.salesRep.id],
        ASSIGNED_REP_BEFORE: [row.salesRepId],
        BOOKER: [row.bookedById],
      },
    });
    if (command.changeRequestId) {
      const request = row.changeRequests.find(
        (candidate) => candidate.id === command.changeRequestId,
      );
      if (request) {
        await this.notifyRequesterDone(actor, detail, request.requestedById);
      }
    }
    return detail;
  }

  /**
   * Manual, confirmed cancellation (spec §7). The slot becomes free; the N8 e-mail is
   * prepared as a draft and sent manually from the preview.
   */
  async cancel(
    actor: Actor,
    id: string,
    command: CancelAppointmentRequest,
  ): Promise<AppointmentDetail> {
    const row = await this.queries.loadRow(id);
    if (!this.policy.abilitiesFor(actor, factsOf(row)).cancel) {
      throw new ForbiddenError();
    }
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.appointment.updateMany({
        where: { id, version: command.expectedVersion, status: AppointmentStatus.Scheduled },
        data: {
          status: AppointmentStatus.Cancelled,
          cancelledAt: new Date(),
          cancelledById: actor.id,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) {
        throw new VersionConflictError();
      }
      await tx.schedulePlan.updateMany({
        where: { appointmentId: id },
        data: { deletedAt: new Date() },
      });
      await tx.changeRequest.updateMany({
        where: { appointmentId: id, status: { in: ['REQUESTED', 'IN_PROGRESS'] } },
        data: { status: 'DONE', doneAt: new Date(), handlerId: actor.id },
      });
      await tx.appointmentChange.create({
        data: {
          appointmentId: id,
          changedById: actor.id,
          before: { status: row.status, ...snapshot(row) },
          after: { status: AppointmentStatus.Cancelled, note: command.note ?? null },
        },
      });
    });
    await this.audit.record({
      action: AuditAction.AppointmentCancelled,
      actorUserId: actor.id,
      targetType: 'appointment',
      targetId: id,
      before: { status: row.status, ...snapshot(row) },
      after: { status: AppointmentStatus.Cancelled, note: command.note ?? null },
    });
    return this.queries.detail(actor, id);
  }

  private async notifyBooked(actor: Actor, detail: AppointmentDetail): Promise<void> {
    const when = formatJstDateTime(new Date(detail.startsAt));
    // Shared on screen with the rep the moment it is registered (spec §2-1). The N1 e-mail
    // is sent from the preview screen.
    await this.notifications.notifyUsers([detail.salesRep.id], {
      code: NoticeCode.Booking,
      title: `新しいアポ：${detail.company.name}（${when}）`,
      linkPath: `/appointments/${detail.id}`,
      actorId: actor.id,
    });
    if (detail.format === MeetingFormat.Online) {
      await this.notifications.notify({
        code: NoticeCode.MeetingLinkRequest,
        title: `会議リンクの発行をお願いします：${detail.company.name}（${when}）`,
        linkPath: `/appointments/${detail.id}`,
        actorId: actor.id,
        context: { ASSIGNED_REP: [detail.salesRep.id] },
      });
    }
  }

  private async notifyRequesterDone(actor: Actor, detail: AppointmentDetail, requesterId: string) {
    await this.notifications.notifyUsers([requesterId], {
      code: NoticeCode.ChangeRequested,
      title: `変更依頼に対応しました：${detail.company.name}`,
      linkPath: `/appointments/${detail.id}`,
      actorId: actor.id,
    });
  }

  /** Existing-list and sales-booked appointments add the company to the register or link to it (spec §7). */
  private async resolveCompany(
    tx: Prisma.TransactionClient,
    actor: Actor,
    command: CreateAppointmentCommand,
  ): Promise<string> {
    if (command.companyId) {
      const exists = await tx.company.findUnique({
        where: { id: command.companyId },
        select: { id: true },
      });
      if (!exists) {
        throw new NotFoundError();
      }
      return exists.id;
    }
    const fields = command.company;
    if (!fields) {
      throw new ValidationError({ company: ['required'] });
    }
    const phoneDigits = phoneDigitsOf(fields.phone);
    const nameKey = normalizeCompanyName(fields.name);
    const match = await tx.company.findFirst({
      where: phoneDigits ? { nameKey, phoneDigits } : { nameKey },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (match) {
      return match.id;
    }
    const created = await tx.company.create({
      data: {
        ...companyWriteData(fields),
        listName: command.listName ?? null,
        createdById: actor.id,
        isCallTarget: false,
      },
    });
    await this.audit.record({
      action: AuditAction.CompanyCreated,
      actorUserId: actor.id,
      targetType: 'company',
      targetId: created.id,
      after: { name: created.name, phone: created.phone, source: command.source },
    });
    return created.id;
  }

  private async assertSalesRep(userId: string): Promise<void> {
    const rep = await this.prisma.user.findFirst({
      where: {
        id: userId,
        status: 'ACTIVE',
        roles: { some: { appKey: APP_KEY, role: Role.Sales } },
      },
      select: { id: true },
    });
    if (!rep) {
      throw new ValidationError({ salesRepId: ['not_sales_rep'] });
    }
  }

  private mapOverlap(error: unknown): unknown {
    if (
      isExclusionViolation(error) ||
      (error instanceof Prisma.PrismaClientUnknownRequestError &&
        isExclusionViolation(error.message))
    ) {
      return new SlotUnavailableError([{ kind: 'OVERLAP', title: '', startsAt: '', endsAt: '' }]);
    }
    return error;
  }
}
