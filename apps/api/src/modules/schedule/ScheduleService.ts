import { randomUUID } from 'node:crypto';
import type { planRequestSchema } from '@telesales/shared';
import {
  addDays,
  APP_KEY,
  fromJst,
  isTelemaSource,
  jstDate,
  NoticeCode,
  OptionCategory,
  type PlanDto,
  PlanStatus,
  Role,
  type ScheduleResponse,
  type SlotCheckResult,
  type TimeOffDto,
  type TimeOffRequest,
  formatJstDateTime,
} from '@telesales/shared';
import type { z } from 'zod';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { AccessPolicy, Actor } from '../../domain/access/AccessPolicy.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import {
  ForbiddenError,
  InvalidStateError,
  NotFoundError,
  SlotUnavailableError,
  ValidationError,
} from '../../http/errors/AppError.js';
import { dateOnly, iso, toDbDate, userRef, userRefSelect } from '../../http/mappers.js';
import type { NotificationService } from '../notifications/NotificationService.js';
import type { SettingsService } from '../settings/SettingsService.js';
import type { SlotGuard } from './SlotGuard.js';

type PlanCommand = z.output<typeof planRequestSchema>;

const WEEK_MS = 7 * 24 * 60 * 60_000;

const planInclude = {
  owner: userRefSelect,
  createdBy: userRefSelect,
  attendees: { include: { user: userRefSelect } },
  appointment: {
    select: {
      id: true,
      format: true,
      status: true,
      source: true,
      company: { select: { name: true } },
    },
  },
} satisfies Prisma.SchedulePlanInclude;

type PlanRow = Prisma.SchedulePlanGetPayload<{ include: typeof planInclude }>;

function planAudit(row: {
  title: string;
  type: string;
  startsAt: Date;
  endsAt: Date;
  ownerId: string;
  status: string;
}) {
  return {
    title: row.title,
    type: row.type,
    ownerId: row.ownerId,
    status: row.status,
    startsAt: iso(row.startsAt),
    endsAt: iso(row.endsAt),
  };
}

/**
 * ② The single sales schedule (spec §2-10): plans, attendees, time off and candidate dates.
 * Appointments appear here as plans but are only moved through the appointment itself.
 */
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly guard: SlotGuard,
    private readonly policy: AccessPolicy,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditLogger,
  ) {}

  async getSchedule(
    actor: Actor,
    from: string,
    to: string,
    userIds: string[],
  ): Promise<ScheduleResponse> {
    if (to < from || addDays(from, 62) < to) {
      throw new ValidationError({ to: ['invalid_range'] });
    }
    const rangeStart = fromJst(from);
    const rangeEnd = fromJst(addDays(to, 1));

    const salesUsers = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', roles: { some: { appKey: APP_KEY, role: Role.Sales } } },
      select: { id: true, name: true },
      orderBy: [{ employeeNo: 'asc' }, { name: 'asc' }],
    });
    const salesIds = new Set(salesUsers.map((user) => user.id));
    const extra = userIds.filter((id) => !salesIds.has(id));
    const extraUsers = extra.length
      ? await this.prisma.user.findMany({
          where: { id: { in: extra } },
          select: { id: true, name: true },
        })
      : [];
    const people = [
      ...salesUsers.map((user) => ({ ...user, isSales: true })),
      ...extraUsers.map((user) => ({ ...user, isSales: false })),
    ];
    const targetIds = userIds.length > 0 ? userIds : salesUsers.map((user) => user.id);

    const [plans, timeOff, holidays, locks, settings] = await Promise.all([
      this.prisma.schedulePlan.findMany({
        where: {
          deletedAt: null,
          startsAt: { lt: rangeEnd },
          endsAt: { gt: rangeStart },
          OR: [
            { ownerId: { in: targetIds } },
            { attendees: { some: { userId: { in: targetIds } } } },
          ],
        },
        include: planInclude,
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.timeOff.findMany({
        where: {
          deletedAt: null,
          userId: { in: targetIds },
          startsAt: { lt: rangeEnd },
          endsAt: { gt: rangeStart },
        },
        include: { user: userRefSelect, enteredBy: userRefSelect },
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.calendarDay.findMany({
        where: { date: { gte: toDbDate(from), lte: toDbDate(to) } },
        orderBy: { date: 'asc' },
      }),
      this.guard.activeLocks(actor.id, { salesRepIds: targetIds, from: rangeStart, to: rangeEnd }),
      this.settings.get(),
    ]);

    return {
      people,
      plans: plans.map((plan) => this.toPlanDto(actor, plan)),
      timeOff: timeOff.map((row) => this.toTimeOffDto(row)),
      holidays: holidays.map((day) => ({
        date: dateOnly(day.date),
        name: day.name,
        kind: day.kind,
      })),
      locks,
      travelBufferMinutes: settings.travelBufferMinutes,
    };
  }

  async getPlan(actor: Actor, id: string): Promise<PlanDto> {
    const row = await this.prisma.schedulePlan.findFirst({
      where: { id, deletedAt: null },
      include: planInclude,
    });
    if (!row) {
      throw new NotFoundError();
    }
    return this.toPlanDto(actor, row);
  }

  checkSlot(
    actor: Actor,
    input: {
      salesRepId: string;
      startsAt: Date;
      endsAt: Date;
      appointmentId?: string | null;
      kind: 'APPOINTMENT' | 'PLAN';
      planId?: string | null;
      holidayWork?: boolean;
    },
  ): Promise<SlotCheckResult> {
    return this.guard.check({ ...input, actorId: actor.id });
  }

  async createPlan(actor: Actor, input: PlanCommand): Promise<PlanDto[]> {
    this.assertCanWritePlans(actor);
    await this.assertPlanType(input.type);
    const occurrences = this.occurrences(input);
    for (const occurrence of occurrences) {
      await this.assertPlanSlot(actor, input, occurrence.startsAt, occurrence.endsAt, null);
    }
    const seriesId = occurrences.length > 1 ? randomUUID() : null;
    const attendeeIds = [...new Set(input.attendeeIds)].filter((id) => id !== input.ownerId);

    const created = await this.prisma.$transaction(async (tx) => {
      const rows: PlanRow[] = [];
      for (const occurrence of occurrences) {
        rows.push(
          await tx.schedulePlan.create({
            data: {
              ownerId: input.ownerId,
              createdById: actor.id,
              type: input.type,
              title: input.title,
              startsAt: occurrence.startsAt,
              endsAt: occurrence.endsAt,
              allDay: input.allDay,
              status: input.status,
              holidayWork: input.holidayWork,
              note: input.note ?? null,
              candidateGroupId:
                input.status === PlanStatus.Tentative
                  ? (input.candidateGroupId ?? randomUUID())
                  : null,
              seriesId,
              recurrenceRule: input.repeat ? `WEEKLY;COUNT=${input.repeat.weeklyCount}` : null,
              attendees: { create: attendeeIds.map((userId) => ({ userId })) },
            },
            include: planInclude,
          }),
        );
      }
      return rows;
    });

    const [first] = created;
    if (!first) {
      return [];
    }
    await this.audit.record({
      action: AuditAction.PlanCreated,
      actorUserId: actor.id,
      targetType: 'plan',
      targetId: first.id,
      after: { ...planAudit(first), count: created.length, attendeeIds },
    });
    await this.notifyPlanChange(actor, first, 'added', attendeeIds);
    return created.map((row) => this.toPlanDto(actor, row));
  }

  async updatePlan(actor: Actor, id: string, input: PlanCommand): Promise<PlanDto> {
    const before = await this.prisma.schedulePlan.findFirst({
      where: { id, deletedAt: null },
      include: planInclude,
    });
    if (!before) {
      throw new NotFoundError();
    }
    if (!this.policy.canEditPlan(actor, before)) {
      throw new ForbiddenError();
    }
    await this.assertPlanType(input.type);
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    await this.assertPlanSlot(actor, input, startsAt, endsAt, id);
    const attendeeIds = [...new Set(input.attendeeIds)].filter(
      (userId) => userId !== input.ownerId,
    );
    const previousAttendees = new Set(before.attendees.map((attendee) => attendee.userId));

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.planAttendee.deleteMany({ where: { planId: id } });
      return tx.schedulePlan.update({
        where: { id },
        data: {
          ownerId: input.ownerId,
          type: input.type,
          title: input.title,
          startsAt,
          endsAt,
          allDay: input.allDay,
          status: input.status,
          holidayWork: input.holidayWork,
          note: input.note ?? null,
          candidateGroupId:
            input.status === PlanStatus.Tentative
              ? (before.candidateGroupId ?? input.candidateGroupId ?? randomUUID())
              : null,
          attendees: { create: attendeeIds.map((userId) => ({ userId })) },
        },
        include: planInclude,
      });
    });
    await this.audit.record({
      action: AuditAction.PlanUpdated,
      actorUserId: actor.id,
      targetType: 'plan',
      targetId: id,
      before: planAudit(before),
      after: planAudit(row),
    });
    await this.notifyPlanChange(
      actor,
      row,
      'changed',
      attendeeIds.filter((userId) => !previousAttendees.has(userId)),
    );
    return this.toPlanDto(actor, row);
  }

  async deletePlan(actor: Actor, id: string, wholeSeries: boolean): Promise<void> {
    const plan = await this.prisma.schedulePlan.findFirst({
      where: { id, deletedAt: null },
      include: planInclude,
    });
    if (!plan) {
      throw new NotFoundError();
    }
    if (!this.policy.canEditPlan(actor, plan)) {
      throw new ForbiddenError();
    }
    const now = new Date();
    await this.prisma.schedulePlan.updateMany({
      where:
        wholeSeries && plan.seriesId
          ? { seriesId: plan.seriesId, deletedAt: null, startsAt: { gte: plan.startsAt } }
          : { id },
      data: { deletedAt: now },
    });
    await this.audit.record({
      action: AuditAction.PlanDeleted,
      actorUserId: actor.id,
      targetType: 'plan',
      targetId: id,
      before: planAudit(plan),
      metadata: { wholeSeries },
    });
    await this.notifyPlanChange(actor, plan, 'deleted', []);
  }

  /** Confirm one tentative candidate; the other candidates of the group are removed. */
  async confirmCandidate(actor: Actor, planId: string): Promise<PlanDto> {
    const plan = await this.prisma.schedulePlan.findFirst({
      where: { id: planId, deletedAt: null },
      include: planInclude,
    });
    if (!plan) {
      throw new NotFoundError();
    }
    if (!this.policy.canEditPlan(actor, plan)) {
      throw new ForbiddenError();
    }
    if (plan.status !== PlanStatus.Tentative) {
      throw new InvalidStateError({ reason: 'not_tentative' });
    }
    const row = await this.prisma.$transaction(async (tx) => {
      if (plan.candidateGroupId) {
        await tx.schedulePlan.updateMany({
          where: { candidateGroupId: plan.candidateGroupId, id: { not: planId }, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      }
      return tx.schedulePlan.update({
        where: { id: planId },
        data: { status: PlanStatus.Fixed, candidateGroupId: null },
        include: planInclude,
      });
    });
    await this.audit.record({
      action: AuditAction.PlanUpdated,
      actorUserId: actor.id,
      targetType: 'plan',
      targetId: planId,
      before: planAudit(plan),
      after: planAudit(row),
      metadata: { confirmedCandidate: true },
    });
    return this.toPlanDto(actor, row);
  }

  async createTimeOff(actor: Actor, input: TimeOffRequest): Promise<TimeOffDto> {
    if (!this.policy.canEditTimeOff(actor)) {
      throw new ForbiddenError();
    }
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (endsAt <= startsAt) {
      throw new SlotUnavailableError([{ kind: 'INVALID_TIME' }]);
    }
    const row = await this.prisma.timeOff.create({
      data: {
        userId: input.userId,
        enteredById: actor.id,
        kind: input.kind,
        startsAt,
        endsAt,
        allDay: input.allDay ?? false,
        note: input.note ?? null,
      },
      include: { user: userRefSelect, enteredBy: userRefSelect },
    });
    await this.audit.record({
      action: AuditAction.TimeOffCreated,
      actorUserId: actor.id,
      targetType: 'time_off',
      targetId: row.id,
      after: {
        userId: row.userId,
        kind: row.kind,
        startsAt: iso(row.startsAt),
        endsAt: iso(row.endsAt),
      },
    });
    if (row.userId !== actor.id) {
      await this.notifications.notify({
        code: NoticeCode.PlanChangedByOther,
        title: `${row.enteredBy.name}さんがお休みを入力しました：${formatJstDateTime(row.startsAt)}`,
        linkPath: `/schedule?date=${jstDate(row.startsAt)}`,
        actorId: actor.id,
        context: { PLAN_OWNER: [row.userId] },
      });
    }
    return this.toTimeOffDto(row);
  }

  async deleteTimeOff(actor: Actor, id: string): Promise<void> {
    if (!this.policy.canEditTimeOff(actor)) {
      throw new ForbiddenError();
    }
    const row = await this.prisma.timeOff.findFirst({ where: { id, deletedAt: null } });
    if (!row) {
      throw new NotFoundError();
    }
    await this.prisma.timeOff.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({
      action: AuditAction.TimeOffDeleted,
      actorUserId: actor.id,
      targetType: 'time_off',
      targetId: id,
      before: {
        userId: row.userId,
        kind: row.kind,
        startsAt: iso(row.startsAt),
        endsAt: iso(row.endsAt),
      },
    });
  }

  toPlanDto(actor: Actor, row: PlanRow): PlanDto {
    return {
      id: row.id,
      owner: userRef(row.owner),
      createdBy: userRef(row.createdBy),
      type: row.type,
      title: row.title,
      startsAt: iso(row.startsAt),
      endsAt: iso(row.endsAt),
      allDay: row.allDay,
      status: row.status,
      holidayWork: row.holidayWork,
      note: row.note,
      candidateGroupId: row.candidateGroupId,
      seriesId: row.seriesId,
      attendees: row.attendees.map((attendee) => userRef(attendee.user)),
      appointment: row.appointment
        ? {
            id: row.appointment.id,
            companyName: row.appointment.company.name,
            format: row.appointment.format,
            status: row.appointment.status,
            isTelema: isTelemaSource(row.appointment.source),
          }
        : null,
      canEdit: this.policy.canEditPlan(actor, row),
    };
  }

  private toTimeOffDto(
    row: Prisma.TimeOffGetPayload<{
      include: { user: typeof userRefSelect; enteredBy: typeof userRefSelect };
    }>,
  ): TimeOffDto {
    return {
      id: row.id,
      user: userRef(row.user),
      enteredBy: userRef(row.enteredBy),
      kind: row.kind,
      startsAt: iso(row.startsAt),
      endsAt: iso(row.endsAt),
      allDay: row.allDay,
      note: row.note,
    };
  }

  private assertCanWritePlans(actor: Actor): void {
    if (!this.policy.canEditPlan(actor, { ownerId: '', appointmentId: null })) {
      throw new ForbiddenError();
    }
  }

  private async assertPlanType(type: string): Promise<void> {
    const option = await this.prisma.optionItem.findUnique({
      where: { category_code: { category: OptionCategory.PlanType, code: type } },
    });
    if (!option?.isActive) {
      throw new ValidationError({ type: ['invalid_option'] });
    }
  }

  private async assertPlanSlot(
    actor: Actor,
    input: PlanCommand,
    startsAt: Date,
    endsAt: Date,
    planId: string | null,
  ) {
    const result = await this.guard.check({
      salesRepId: input.ownerId,
      startsAt,
      endsAt,
      actorId: actor.id,
      kind: 'PLAN',
      planId,
      holidayWork: input.holidayWork,
    });
    if (!result.ok) {
      throw new SlotUnavailableError(result.problems);
    }
  }

  private occurrences(input: PlanCommand): { startsAt: Date; endsAt: Date }[] {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    const count = input.repeat?.weeklyCount ?? 1;
    return Array.from({ length: count }, (_, index) => ({
      startsAt: new Date(startsAt.getTime() + index * WEEK_MS),
      endsAt: new Date(endsAt.getTime() + index * WEEK_MS),
    }));
  }

  /** N9 for new attendees; N10 when someone other than the owner changes the plan. */
  private async notifyPlanChange(
    actor: Actor,
    plan: PlanRow,
    verb: 'added' | 'changed' | 'deleted',
    newAttendeeIds: string[],
  ) {
    const when = formatJstDateTime(plan.startsAt);
    const link = `/schedule?date=${jstDate(plan.startsAt)}`;
    if (newAttendeeIds.length > 0 && verb !== 'deleted') {
      await this.notifications.notify({
        code: NoticeCode.AddedAsAttendee,
        title: `同席者に入りました：${plan.title}（${when}）`,
        linkPath: link,
        actorId: actor.id,
        context: { ATTENDEES: newAttendeeIds },
      });
    }
    if (plan.ownerId !== actor.id) {
      const label = { added: '追加', changed: '変更', deleted: '削除' }[verb];
      await this.notifications.notify({
        code: NoticeCode.PlanChangedByOther,
        title: `予定が${label}されました：${plan.title}（${when}）`,
        linkPath: link,
        actorId: actor.id,
        context: { PLAN_OWNER: [plan.ownerId] },
      });
    }
  }
}
