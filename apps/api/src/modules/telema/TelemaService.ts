import {
  addDays,
  APP_KEY,
  dayOfWeek,
  type FillShiftsResponse,
  isRole,
  jstDate,
  NoticeCode,
  Role,
  type ShiftDto,
  ShiftKind,
  type ShiftMonthResponse,
  type ShiftRequest,
  sortRoles,
  type TelemarketerDto,
  type TelemarketerRequest,
  type TodayStaffResponse,
  type UsualHoursRequest,
} from '@telesales/shared';
import type { AccessPolicy, Actor } from '../../domain/access/AccessPolicy.js';
import { workingMinutesOf } from '../../domain/allocation/Allocator.js';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { CalendarRepository } from '../../domain/calendar/CalendarRepository.js';
import type { Clock } from '../../domain/Clock.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { ForbiddenError, NotFoundError } from '../../http/errors/AppError.js';
import { dateOnly, iso, toDbDate, userRef, userRefSelect } from '../../http/mappers.js';
import type { NotificationService } from '../notifications/NotificationService.js';

const TELEMA_ROLES = [Role.Telema, Role.TelemaLead];

interface ProfileValues {
  jobType: string | null;
  isAllocationTarget: boolean;
  territory: string[];
  usualStart: string | null;
  usualEnd: string | null;
  usualBreakMinutes: number;
  usualWeekdays: number[];
}

/** Until a lead saves someone's info: an allocation target, weekdays, 1 hour break. */
const DEFAULT_PROFILE: ProfileValues = {
  jobType: null,
  isAllocationTarget: true,
  territory: [],
  usualStart: null,
  usualEnd: null,
  usualBreakMinutes: 60,
  usualWeekdays: [1, 2, 3, 4, 5],
};

interface ShiftRow {
  id: string;
  userId: string;
  date: Date;
  kind: string;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
  workingMinutes: number;
  note: string | null;
  updatedAt: Date;
  enteredBy: { id: string; name: string } | null;
}

function toShiftDto(row: ShiftRow): ShiftDto {
  return {
    id: row.id,
    userId: row.userId,
    date: dateOnly(row.date),
    kind: row.kind === ShiftKind.Off ? ShiftKind.Off : ShiftKind.Work,
    startTime: row.startTime,
    endTime: row.endTime,
    breakMinutes: row.breakMinutes,
    workingMinutes: row.workingMinutes,
    note: row.note,
    enteredBy: userRef(row.enteredBy),
    updatedAt: iso(row.updatedAt),
  };
}

/** Every date of a 'YYYY-MM' month, with the first and last for range queries. */
function monthDates(month: string): { dates: string[]; first: string; last: string } {
  const first = `${month}-01`;
  const dates: string[] = [];
  let last = first;
  for (let day = first; day.startsWith(month); day = addDays(day, 1)) {
    dates.push(day);
    last = day;
  }
  return { dates, first, last };
}

/** Telemarketing team (spec §5–§7, priority 2): who they are, their usual hours, monthly shifts. */
export class TelemaService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly policy: AccessPolicy,
    private readonly calendar: CalendarRepository,
    private readonly notifications: NotificationService,
    private readonly audit: AuditLogger,
    private readonly clock: Clock,
  ) {}

  /** Active telemarketers and leads, with their profile (defaults until one is saved). */
  async telemarketers(): Promise<TelemarketerDto[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        roles: { some: { appKey: APP_KEY, role: { in: TELEMA_ROLES } } },
      },
      include: { roles: { where: { appKey: APP_KEY } }, telemarketer: true },
      orderBy: [{ employeeNo: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => {
      const profile = row.telemarketer ?? DEFAULT_PROFILE;
      return {
        user: userRef(row),
        roles: sortRoles(row.roles.map((r) => r.role).filter(isRole)),
        jobType: profile.jobType,
        isAllocationTarget: profile.isAllocationTarget,
        territory: profile.territory,
        usualStart: profile.usualStart,
        usualEnd: profile.usualEnd,
        usualBreakMinutes: profile.usualBreakMinutes,
        usualWeekdays: profile.usualWeekdays,
      };
    });
  }

  /** Leads and admins: everything about a telemarketer. */
  async updateTelemarketer(
    actor: Actor,
    userId: string,
    input: TelemarketerRequest,
  ): Promise<TelemarketerDto> {
    if (!this.policy.managesTelema(actor)) {
      throw new ForbiddenError();
    }
    return this.saveProfile(actor, userId, {
      jobType: input.jobType ?? null,
      isAllocationTarget: input.isAllocationTarget,
      territory: [...new Set(input.territory)],
      usualStart: input.usualStart,
      usualEnd: input.usualEnd,
      usualBreakMinutes: input.usualBreakMinutes,
      usualWeekdays: [...new Set(input.usualWeekdays)].sort(),
    });
  }

  /** A telemarketer: their own usual hours only. */
  async updateOwnUsualHours(actor: Actor, input: UsualHoursRequest): Promise<TelemarketerDto> {
    return this.saveProfile(actor, actor.id, {
      usualStart: input.usualStart,
      usualEnd: input.usualEnd,
      usualBreakMinutes: input.usualBreakMinutes,
      usualWeekdays: [...new Set(input.usualWeekdays)].sort(),
    });
  }

  async shiftMonth(month: string): Promise<ShiftMonthResponse> {
    const { dates, first, last } = monthDates(month);
    const [calendar, people, rows] = await Promise.all([
      this.calendar.load(first, last),
      this.telemarketers(),
      this.prisma.shift.findMany({
        where: { date: { gte: toDbDate(first), lte: toDbDate(last) } },
        include: { enteredBy: userRefSelect },
        orderBy: [{ date: 'asc' }],
      }),
    ]);
    return {
      month,
      days: dates.map((date) => ({
        date,
        businessDay: calendar.isBusinessDay(date),
        holidayName: calendar.holidayName(date),
      })),
      people,
      shifts: rows.map(toShiftDto),
    };
  }

  async saveShift(actor: Actor, input: ShiftRequest): Promise<ShiftDto> {
    const today = this.today();
    if (!this.policy.canEditShift(actor, input.userId, input.date, today)) {
      throw new ForbiddenError();
    }
    await this.assertTelemarketer(input.userId);
    const work = input.kind === ShiftKind.Work;
    const startTime = work ? (input.startTime ?? null) : null;
    const endTime = work ? (input.endTime ?? null) : null;
    const breakMinutes = work ? (input.breakMinutes ?? 0) : 0;
    const data = {
      kind: input.kind,
      startTime,
      endTime,
      breakMinutes,
      workingMinutes: startTime && endTime ? workingMinutesOf(startTime, endTime, breakMinutes) : 0,
      note: input.note ?? null,
      enteredById: actor.id,
    };
    const key = { userId_date: { userId: input.userId, date: toDbDate(input.date) } };
    const before = await this.prisma.shift.findUnique({ where: key });
    const row = await this.prisma.shift.upsert({
      where: key,
      create: { userId: input.userId, date: toDbDate(input.date), ...data },
      update: data,
      include: { enteredBy: userRefSelect },
    });
    await this.audit.record({
      action: AuditAction.ShiftSaved,
      actorUserId: actor.id,
      targetType: 'shift',
      targetId: row.id,
      before: before ? { ...toShiftDto({ ...before, enteredBy: null }) } : undefined,
      after: { ...toShiftDto(row) },
    });
    await this.tellOwner(actor, input.userId, input.date, work ? 'シフトを変更' : '休みを登録');
    return toShiftDto(row);
  }

  async deleteShift(actor: Actor, id: string): Promise<void> {
    const row = await this.prisma.shift.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundError();
    }
    const date = dateOnly(row.date);
    if (!this.policy.canEditShift(actor, row.userId, date, this.today())) {
      throw new ForbiddenError();
    }
    await this.prisma.shift.delete({ where: { id } });
    await this.audit.record({
      action: AuditAction.ShiftDeleted,
      actorUserId: actor.id,
      targetType: 'shift',
      targetId: id,
      before: { ...toShiftDto({ ...row, enteredBy: null }) },
    });
    await this.tellOwner(actor, row.userId, date, 'シフトを消去');
  }

  /**
   * Fills the month from each person's usual hours: business days on their usual
   * weekdays only, and never over a day that already has a shift.
   */
  async fillMonth(actor: Actor, month: string, userIds?: string[]): Promise<FillShiftsResponse> {
    const manages = this.policy.managesTelema(actor);
    const people = (await this.telemarketers()).filter((person) =>
      userIds ? userIds.includes(person.user.id) : manages || person.user.id === actor.id,
    );
    if (people.some((person) => !manages && person.user.id !== actor.id)) {
      throw new ForbiddenError();
    }
    const { dates, first, last } = monthDates(month);
    const today = this.today();
    const calendar = await this.calendar.load(first, last);
    const existing = await this.prisma.shift.findMany({
      where: {
        userId: { in: people.map((person) => person.user.id) },
        date: { gte: toDbDate(first), lte: toDbDate(last) },
      },
      select: { userId: true, date: true },
    });
    const taken = new Set(existing.map((row) => `${row.userId}:${dateOnly(row.date)}`));

    const rows: {
      userId: string;
      date: Date;
      kind: string;
      startTime: string;
      endTime: string;
      breakMinutes: number;
      workingMinutes: number;
      enteredById: string;
    }[] = [];
    let skipped = 0;
    for (const person of people) {
      const { usualStart, usualEnd, usualBreakMinutes, usualWeekdays } = person;
      if (!usualStart || !usualEnd) {
        continue;
      }
      for (const date of dates) {
        if (
          date < today ||
          !calendar.isBusinessDay(date) ||
          !usualWeekdays.includes(dayOfWeek(date))
        ) {
          continue;
        }
        if (taken.has(`${person.user.id}:${date}`)) {
          skipped += 1;
          continue;
        }
        rows.push({
          userId: person.user.id,
          date: toDbDate(date),
          kind: ShiftKind.Work,
          startTime: usualStart,
          endTime: usualEnd,
          breakMinutes: usualBreakMinutes,
          workingMinutes: workingMinutesOf(usualStart, usualEnd, usualBreakMinutes),
          enteredById: actor.id,
        });
      }
    }
    const created = (await this.prisma.shift.createMany({ data: rows, skipDuplicates: true }))
      .count;
    await this.audit.record({
      action: AuditAction.ShiftsFilled,
      actorUserId: actor.id,
      targetType: 'shift',
      metadata: { month, created, skipped, userIds: people.map((person) => person.user.id) },
    });
    return { created, skipped };
  }

  /** Who is working on a day, who is off, and whose shift is missing. */
  async staffOn(date = this.today()): Promise<TodayStaffResponse> {
    const [calendar, people, rows] = await Promise.all([
      this.calendar.load(date, date),
      this.telemarketers(),
      this.prisma.shift.findMany({ where: { date: toDbDate(date) } }),
    ]);
    const byUser = new Map(rows.map((row) => [row.userId, row]));
    const result: TodayStaffResponse = {
      date,
      businessDay: calendar.isBusinessDay(date),
      working: [],
      off: [],
      missing: [],
    };
    for (const person of people) {
      const shift = byUser.get(person.user.id);
      if (!shift) {
        result.missing.push(person.user);
      } else if (shift.kind === ShiftKind.Off || shift.workingMinutes === 0) {
        result.off.push({ user: person.user, note: shift.note });
      } else {
        result.working.push({
          user: person.user,
          startTime: shift.startTime,
          endTime: shift.endTime,
          breakMinutes: shift.breakMinutes,
          workingMinutes: shift.workingMinutes,
          isAllocationTarget: person.isAllocationTarget,
          note: shift.note,
        });
      }
    }
    result.working.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
    return result;
  }

  private async saveProfile(
    actor: Actor,
    userId: string,
    data: Partial<ProfileValues>,
  ): Promise<TelemarketerDto> {
    await this.assertTelemarketer(userId);
    const before = await this.prisma.telemarketerProfile.findUnique({ where: { userId } });
    await this.prisma.telemarketerProfile.upsert({
      where: { userId },
      create: { ...DEFAULT_PROFILE, ...data, userId },
      update: data,
    });
    await this.audit.record({
      action: AuditAction.TelemarketerUpdated,
      actorUserId: actor.id,
      targetType: 'telemarketer_profile',
      targetId: userId,
      before: before ? { ...before } : undefined,
      after: { ...data },
    });
    const updated = (await this.telemarketers()).find((person) => person.user.id === userId);
    if (!updated) {
      throw new NotFoundError();
    }
    return updated;
  }

  private async assertTelemarketer(userId: string): Promise<void> {
    const found = await this.prisma.userAppRole.findFirst({
      where: { userId, appKey: APP_KEY, role: { in: TELEMA_ROLES }, user: { status: 'ACTIVE' } },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundError();
    }
  }

  /** Someone else changed your shift (N10, same as plans). */
  private async tellOwner(actor: Actor, ownerId: string, date: string, what: string) {
    if (ownerId === actor.id) {
      return;
    }
    await this.notifications.notify({
      code: NoticeCode.PlanChangedByOther,
      context: { PLAN_OWNER: [ownerId] },
      actorId: actor.id,
      title: `${date.slice(5).replace('-', '/')} の${what}しました`,
      linkPath: `/telema/shifts?month=${date.slice(0, 7)}`,
    });
  }

  private today(): string {
    return jstDate(this.clock.now());
  }
}
