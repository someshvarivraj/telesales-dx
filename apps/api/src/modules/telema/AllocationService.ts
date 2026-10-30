import {
  addDays,
  type AllocationDayResponse,
  type AllocationItemDto,
  AllocationKind,
  AllocationStatus,
  AppointmentSource,
  AppointmentStatus,
  fromJst,
  jstDate,
  type MyAssignmentsResponse,
  NoticeCode,
  ShiftKind,
  type UserRef,
} from '@telesales/shared';
import type { AccessPolicy, Actor } from '../../domain/access/AccessPolicy.js';
import { Allocator } from '../../domain/allocation/Allocator.js';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { CalendarRepository } from '../../domain/calendar/CalendarRepository.js';
import type { Clock } from '../../domain/Clock.js';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { ForbiddenError, InvalidStateError, ValidationError } from '../../http/errors/AppError.js';
import { iso, toDbDate, userRef, userRefSelect } from '../../http/mappers.js';
import type { NotificationService } from '../notifications/NotificationService.js';
import type { TelemaService } from './TelemaService.js';

const itemInclude = {
  assignee: userRefSelect,
  company: {
    select: { id: true, name: true, phone: true, prefecture: true, city: true, listName: true },
  },
  appointment: {
    select: {
      id: true,
      startsAt: true,
      company: { select: { name: true } },
      salesRep: userRefSelect,
      bookedBy: userRefSelect,
    },
  },
} as const;

type ItemRow = Prisma.AllocationGetPayload<{ include: typeof itemInclude }>;

function toItemDto(row: ItemRow): AllocationItemDto {
  return {
    id: row.id,
    kind: row.kind,
    assignee: userRef(row.assignee),
    status: row.status,
    company: row.company,
    appointment: row.appointment
      ? {
          id: row.appointment.id,
          companyName: row.appointment.company.name,
          startsAt: iso(row.appointment.startsAt),
          salesRep: userRef(row.appointment.salesRep),
          bookedBy: userRef(row.appointment.bookedBy),
        }
      : null,
  };
}

interface Participants {
  /** Allocation targets who are working, with their working minutes. */
  targets: { user: UserRef; workingMinutes: number }[];
  /** Everyone with a working shift (bookers keep their own day-before checks). */
  working: Set<string>;
  /** Prefectures that someone covers as a fixed territory. */
  fixedTerritory: string[];
}

/**
 * Auto allocation (spec §7, priority 2): the morning run makes a draft, the lead adjusts
 * and confirms it, and only then does each telemarketer see their part.
 */
export class AllocationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly policy: AccessPolicy,
    private readonly team: TelemaService,
    private readonly calendar: CalendarRepository,
    private readonly notifications: NotificationService,
    private readonly audit: AuditLogger,
    private readonly clock: Clock,
  ) {}

  /** The day's allocation. Drafts are only shown to the people who confirm them. */
  async day(actor: Actor, date: string): Promise<AllocationDayResponse> {
    const manages = this.policy.managesTelema(actor);
    const [calendar, participants, rows] = await Promise.all([
      this.calendar.load(date, addDays(date, 14)),
      this.participants(date),
      this.prisma.allocation.findMany({
        where: { date: toDbDate(date) },
        include: { ...itemInclude, confirmedBy: userRefSelect },
        orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    const confirmed = rows.length > 0 && rows.every((row) => row.status === 'CONFIRMED');
    const visible = manages || confirmed ? rows : [];
    const allocator = new Allocator(
      participants.targets.map((t) => ({ userId: t.user.id, workingMinutes: t.workingMinutes })),
    );
    const count = (userId: string, kind: AllocationKind) =>
      visible.filter((row) => row.assigneeId === userId && row.kind === kind).length;
    const assignees = new Map<string, UserRef>();
    participants.targets.forEach((t) => assignees.set(t.user.id, t.user));
    visible.forEach((row) => assignees.set(row.assigneeId, userRef(row.assignee)));
    const minutesOf = new Map(participants.targets.map((t) => [t.user.id, t.workingMinutes]));

    return {
      date,
      businessDay: calendar.isBusinessDay(date),
      state: rows.length === 0 ? 'NONE' : confirmed ? 'CONFIRMED' : 'DRAFT',
      confirmedAt: confirmed ? iso(rows[0]?.confirmedAt ?? null) : null,
      confirmedBy: confirmed ? userRef(rows[0]?.confirmedBy ?? null) : null,
      fixedTerritory: participants.fixedTerritory,
      dayBeforeDates: calendar.checkWindow(date).dates,
      targets: [...assignees.values()].map((user) => ({
        user,
        workingMinutes: minutesOf.get(user.id) ?? 0,
        share: allocator.shareOf(user.id),
        calls: count(user.id, AllocationKind.Call),
        dayBefore: count(user.id, AllocationKind.DayBefore),
      })),
      items: visible.map(toItemDto),
    };
  }

  /**
   * Calculates a fresh draft for the day, replacing any earlier draft or confirmation.
   * `actor` is null for the morning run.
   */
  async calculate(
    actor: Actor | null,
    date: string,
  ): Promise<{ calls: number; dayBefore: number }> {
    if (actor && !this.policy.managesTelema(actor)) {
      throw new ForbiddenError();
    }
    const calendar = await this.calendar.load(date, addDays(date, 14));
    if (!calendar.isBusinessDay(date)) {
      throw new InvalidStateError({ reason: 'not_business_day' });
    }
    const participants = await this.participants(date);
    if (participants.targets.length === 0) {
      throw new InvalidStateError({ reason: 'nobody_working' });
    }
    const allocator = new Allocator(
      participants.targets.map((t) => ({ userId: t.user.id, workingMinutes: t.workingMinutes })),
    );

    const companies = await this.callListOn(date, participants.fixedTerritory);
    const calls = allocator.allocateCalls(
      companies.map((company) => ({ id: company.id, groupKey: company.nameKey || company.id })),
    );

    const { first, last } = calendar.checkWindow(date);
    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.Scheduled,
        source: { not: AppointmentSource.SalesBooked },
        startsAt: { gte: fromJst(first), lt: fromJst(addDays(last, 1)) },
      },
      select: { id: true, bookedById: true },
      orderBy: { startsAt: 'asc' },
    });
    const dayBefore = allocator.allocateDayBefore(appointments, participants.working);

    const day = toDbDate(date);
    await this.prisma.$transaction([
      this.prisma.allocation.deleteMany({ where: { date: day } }),
      this.prisma.allocation.createMany({
        data: [
          ...[...calls].map(([companyId, assigneeId]) => ({
            date: day,
            kind: AllocationKind.Call,
            companyId,
            assigneeId,
          })),
          ...[...dayBefore].map(([appointmentId, assigneeId]) => ({
            date: day,
            kind: AllocationKind.DayBefore,
            appointmentId,
            assigneeId,
          })),
        ],
      }),
    ]);
    const result = { calls: calls.size, dayBefore: dayBefore.size };
    await this.audit.record({
      action: AuditAction.AllocationCalculated,
      actorUserId: actor?.id ?? null,
      targetType: 'allocation',
      targetId: date,
      after: { ...result, targets: participants.targets.map((t) => t.user.id) },
    });
    return result;
  }

  /** The lead hands items to someone else. Moving after confirmation needs a new confirmation. */
  async move(actor: Actor, date: string, ids: string[], assigneeId: string): Promise<void> {
    if (!this.policy.managesTelema(actor)) {
      throw new ForbiddenError();
    }
    const participants = await this.participants(date);
    if (!participants.working.has(assigneeId)) {
      throw new ValidationError({ assigneeId: ['not_working'] });
    }
    const moved = await this.prisma.allocation.updateMany({
      where: { id: { in: ids }, date: toDbDate(date) },
      data: { assigneeId, status: AllocationStatus.Draft, confirmedAt: null, confirmedById: null },
    });
    // Any change re-opens the day so the lead confirms the final version.
    await this.prisma.allocation.updateMany({
      where: { date: toDbDate(date) },
      data: { status: AllocationStatus.Draft, confirmedAt: null, confirmedById: null },
    });
    await this.audit.record({
      action: AuditAction.AllocationMoved,
      actorUserId: actor.id,
      targetType: 'allocation',
      targetId: date,
      after: { assigneeId, count: moved.count },
    });
  }

  /** Confirms the day and tells each person what they have (N11). */
  async confirm(actor: Actor, date: string): Promise<void> {
    if (!this.policy.managesTelema(actor)) {
      throw new ForbiddenError();
    }
    const day = toDbDate(date);
    const rows = await this.prisma.allocation.findMany({
      where: { date: day },
      select: { assigneeId: true, kind: true },
    });
    if (rows.length === 0) {
      throw new InvalidStateError({ reason: 'nothing_to_confirm' });
    }
    await this.prisma.allocation.updateMany({
      where: { date: day },
      data: {
        status: AllocationStatus.Confirmed,
        confirmedAt: this.clock.now(),
        confirmedById: actor.id,
      },
    });
    await this.audit.record({
      action: AuditAction.AllocationConfirmed,
      actorUserId: actor.id,
      targetType: 'allocation',
      targetId: date,
      after: { count: rows.length },
    });

    const counts = new Map<string, { calls: number; dayBefore: number }>();
    for (const row of rows) {
      const entry = counts.get(row.assigneeId) ?? { calls: 0, dayBefore: 0 };
      if (row.kind === AllocationKind.Call) entry.calls += 1;
      else entry.dayBefore += 1;
      counts.set(row.assigneeId, entry);
    }
    for (const [userId, count] of counts) {
      await this.notifications.notify({
        code: NoticeCode.TodayAssignments,
        context: { ASSIGNEE: [userId] },
        title: `今日の担当：架電 ${count.calls}件・前日確認 ${count.dayBefore}件`,
        linkPath: '/telema',
        dedupeKey: `N11:${date}:${rows.length}:${count.calls}:${count.dayBefore}`,
      });
    }
  }

  /** Today's confirmed share for one person (home screen, N11 "at login"). */
  async mine(userId: string, date = this.today()): Promise<MyAssignmentsResponse> {
    const rows = await this.prisma.allocation.groupBy({
      by: ['kind'],
      where: { date: toDbDate(date), assigneeId: userId, status: AllocationStatus.Confirmed },
      _count: { _all: true },
    });
    const count = (kind: AllocationKind) => rows.find((row) => row.kind === kind)?._count._all ?? 0;
    return {
      date,
      confirmed: rows.length > 0,
      calls: count(AllocationKind.Call),
      dayBefore: count(AllocationKind.DayBefore),
    };
  }

  /** True while today's allocation is a draft (or the morning run produced nothing yet). */
  async needsConfirmation(date = this.today()): Promise<boolean> {
    const draft = await this.prisma.allocation.findFirst({
      where: { date: toDbDate(date), status: AllocationStatus.Draft },
      select: { id: true },
    });
    return draft !== null;
  }

  async hasAllocation(date: string): Promise<boolean> {
    return (await this.prisma.allocation.count({ where: { date: toDbDate(date) } })) > 0;
  }

  private async participants(date: string): Promise<Participants> {
    const [people, shifts] = await Promise.all([
      this.team.telemarketers(),
      this.prisma.shift.findMany({
        where: { date: toDbDate(date), kind: ShiftKind.Work, workingMinutes: { gt: 0 } },
      }),
    ]);
    const minutes = new Map(shifts.map((shift) => [shift.userId, shift.workingMinutes]));
    const fixedTerritory = [...new Set(people.flatMap((person) => person.territory))];
    return {
      targets: people
        .filter((person) => person.isAllocationTarget)
        .map((person) => ({ user: person.user, workingMinutes: minutes.get(person.user.id) ?? 0 }))
        .filter((target) => target.workingMinutes > 0),
      working: new Set(
        people.filter((person) => minutes.has(person.user.id)).map((person) => person.user.id),
      ),
      fixedTerritory,
    };
  }

  /**
   * The day's call list: callable companies (not a duplicate), outside the fixed
   * territories, with no appointment coming up, never called or due for another call.
   */
  private async callListOn(
    date: string,
    fixedTerritory: string[],
  ): Promise<{ id: string; nameKey: string }[]> {
    const territory = fixedTerritory.length > 0 ? fixedTerritory : [''];
    return this.prisma.$queryRaw<{ id: string; nameKey: string }[]>(Prisma.sql`
      SELECT c.id, c.name_key AS "nameKey"
      FROM companies c
      LEFT JOIN LATERAL (
        SELECT r.next_call_date, r.avoid_until
        FROM call_records r
        WHERE r.company_id = c.id
        ORDER BY r.called_at DESC
        LIMIT 1
      ) last_call ON true
      WHERE c.is_call_target
        AND c.flag <> 'DUPLICATE'
        AND (c.prefecture IS NULL OR c.prefecture <> ALL(${territory}::text[]))
        AND NOT EXISTS (
          SELECT 1 FROM appointments a
          WHERE a.company_id = c.id AND a.status = 'SCHEDULED'
        )
        AND (
          NOT EXISTS (SELECT 1 FROM call_records r WHERE r.company_id = c.id)
          OR last_call.next_call_date <= ${toDbDate(date)}::date
          -- Grade C with 「C架電回避目安」: back on the list once the time is up.
          OR last_call.avoid_until <= ${toDbDate(date)}::date
        )
      ORDER BY c.prefecture NULLS LAST, c.city NULLS LAST, c.created_at, c.id
    `);
  }

  private today(): string {
    return jstDate(this.clock.now());
  }
}
