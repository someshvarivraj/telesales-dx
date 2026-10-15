import {
  addDays,
  isOnSlotBoundary,
  jstDate,
  type SlotCheckResult,
  type SlotLockDto,
  type SlotProblem,
} from '@telesales/shared';
import type { CalendarRepository } from '../../domain/calendar/CalendarRepository.js';
import type { Clock } from '../../domain/Clock.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { NotFoundError, SlotLockedError } from '../../http/errors/AppError.js';
import { iso, userRef, userRefSelect } from '../../http/mappers.js';
import type { SettingsService } from '../settings/SettingsService.js';

type Db = PrismaClient | Prisma.TransactionClient;

export interface SlotCheckInput {
  salesRepId: string;
  startsAt: Date;
  endsAt: Date;
  /** The appointment being moved (its own plan does not count as an overlap). */
  appointmentId?: string | null;
  /** The person saving; their own lock does not block them. */
  actorId: string;
  /** Appointments must be on business days, outside time off, without overlaps. */
  kind: 'APPOINTMENT' | 'PLAN';
  planId?: string | null;
  holidayWork?: boolean;
}

/**
 * Double-booking protection (spec §2-11, §7):
 * 1. while someone books or edits, only that rep's time slot is locked;
 * 2. on save, everything is checked again inside a per-rep transaction lock;
 * 3. the database exclusion constraint is the last guard.
 */
export class SlotGuard {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly calendar: CalendarRepository,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
    private readonly lockTtlMs: number,
  ) {}

  /** Serialises all writes to one rep's schedule for the rest of the transaction. */
  async lockRep(tx: Prisma.TransactionClient, salesRepId: string): Promise<void> {
    await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${`schedule:${salesRepId}`}))`;
  }

  async check(input: SlotCheckInput, db: Db = this.prisma): Promise<SlotCheckResult> {
    const problems: SlotProblem[] = [];
    const warnings: string[] = [];
    const { startsAt, endsAt } = input;

    if (endsAt <= startsAt || !isOnSlotBoundary(startsAt) || !isOnSlotBoundary(endsAt)) {
      return { ok: false, problems: [{ kind: 'INVALID_TIME' }], warnings };
    }

    const firstDay = jstDate(startsAt);
    const lastDay = jstDate(new Date(endsAt.getTime() - 1));
    const calendar = await this.calendar.load(firstDay, lastDay);
    const mustBeBusinessDay = input.kind === 'APPOINTMENT' || !input.holidayWork;
    if (mustBeBusinessDay) {
      for (let day = firstDay; day <= lastDay; day = addDays(day, 1)) {
        if (!calendar.isBusinessDay(day)) {
          problems.push({ kind: 'NOT_BUSINESS_DAY', date: day, name: calendar.holidayName(day) });
          break;
        }
      }
    }

    const buffer = await this.settings.get();
    const bufferMs = buffer.travelBufferMinutes * 60_000;

    if (input.kind === 'APPOINTMENT') {
      const timeOff = await db.timeOff.findMany({
        where: {
          userId: input.salesRepId,
          deletedAt: null,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
        take: 1,
      });
      if (timeOff[0]) {
        problems.push({
          kind: 'TIME_OFF',
          startsAt: iso(timeOff[0].startsAt),
          endsAt: iso(timeOff[0].endsAt),
        });
      }
    }

    const overlapping = await db.schedulePlan.findMany({
      where: {
        deletedAt: null,
        OR: [{ ownerId: input.salesRepId }, { attendees: { some: { userId: input.salesRepId } } }],
        startsAt: { lt: new Date(endsAt.getTime() + bufferMs) },
        endsAt: { gt: new Date(startsAt.getTime() - bufferMs) },
        ...(input.appointmentId ? { NOT: { appointmentId: input.appointmentId } } : {}),
        ...(input.planId ? { id: { not: input.planId } } : {}),
      },
      select: { title: true, startsAt: true, endsAt: true },
      orderBy: { startsAt: 'asc' },
    });
    for (const plan of overlapping) {
      const realOverlap = plan.startsAt < endsAt && plan.endsAt > startsAt;
      if (realOverlap) {
        if (input.kind === 'APPOINTMENT') {
          problems.push({
            kind: 'OVERLAP',
            title: plan.title,
            startsAt: iso(plan.startsAt),
            endsAt: iso(plan.endsAt),
          });
        } else {
          warnings.push(`「${plan.title}」と時間が重なっています。`);
        }
      } else if (bufferMs > 0) {
        const message = `前後${buffer.travelBufferMinutes}分以内に「${plan.title}」があります（移動時間）。`;
        if (input.kind === 'APPOINTMENT' && buffer.travelBufferMode === 'BLOCK') {
          problems.push({
            kind: 'OVERLAP',
            title: plan.title,
            startsAt: iso(plan.startsAt),
            endsAt: iso(plan.endsAt),
          });
        } else {
          warnings.push(message);
        }
      }
    }

    if (input.kind === 'APPOINTMENT') {
      const lock = await this.conflictingLock(
        db,
        input.salesRepId,
        startsAt,
        endsAt,
        input.actorId,
      );
      if (lock) {
        problems.push({ kind: 'LOCKED', by: lock.lockedBy.name });
      }
    }

    return { ok: problems.length === 0, problems, warnings };
  }

  /** Locks only this rep's slot; others see "[name] is editing" (spec §7). */
  async acquireLock(
    actorId: string,
    salesRepId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<SlotLockDto> {
    const now = this.clock.now();
    const lock = await this.prisma.$transaction(async (tx) => {
      await this.lockRep(tx, salesRepId);
      await tx.slotLock.deleteMany({ where: { expiresAt: { lt: now } } });
      const conflict = await this.conflictingLock(tx, salesRepId, startsAt, endsAt, actorId);
      if (conflict) {
        throw new SlotLockedError({
          by: conflict.lockedBy.name,
          expiresAt: iso(conflict.expiresAt),
        });
      }
      // One booking screen holds one slot of a rep at a time.
      await tx.slotLock.deleteMany({ where: { lockedById: actorId, salesRepId } });
      return tx.slotLock.create({
        data: {
          salesRepId,
          startsAt,
          endsAt,
          lockedById: actorId,
          heartbeatAt: now,
          expiresAt: new Date(now.getTime() + this.lockTtlMs),
        },
        include: { salesRep: userRefSelect, lockedBy: userRefSelect },
      });
    });
    return this.toDto(lock, actorId);
  }

  /** Called every ~30 s while the screen is open, so a long call never loses the lock. */
  async heartbeat(actorId: string, lockId: string): Promise<SlotLockDto> {
    const now = this.clock.now();
    const result = await this.prisma.slotLock.updateMany({
      where: { id: lockId, lockedById: actorId, expiresAt: { gte: now } },
      data: { heartbeatAt: now, expiresAt: new Date(now.getTime() + this.lockTtlMs) },
    });
    if (result.count === 0) {
      throw new NotFoundError();
    }
    const lock = await this.prisma.slotLock.findUniqueOrThrow({
      where: { id: lockId },
      include: { salesRep: userRefSelect, lockedBy: userRefSelect },
    });
    return this.toDto(lock, actorId);
  }

  async release(actorId: string, lockId: string): Promise<void> {
    await this.prisma.slotLock.deleteMany({ where: { id: lockId, lockedById: actorId } });
  }

  async releaseFor(db: Db, actorId: string, salesRepId: string): Promise<void> {
    await db.slotLock.deleteMany({ where: { lockedById: actorId, salesRepId } });
  }

  async activeLocks(
    actorId: string,
    filter: { salesRepIds?: string[]; from?: Date; to?: Date } = {},
  ): Promise<SlotLockDto[]> {
    const rows = await this.prisma.slotLock.findMany({
      where: {
        expiresAt: { gte: this.clock.now() },
        ...(filter.salesRepIds && filter.salesRepIds.length > 0
          ? { salesRepId: { in: filter.salesRepIds } }
          : {}),
        ...(filter.from && filter.to
          ? { startsAt: { lt: filter.to }, endsAt: { gt: filter.from } }
          : {}),
      },
      include: { salesRep: userRefSelect, lockedBy: userRefSelect },
      orderBy: { startsAt: 'asc' },
    });
    return rows.map((row) => this.toDto(row, actorId));
  }

  /** Admins release a lock by hand (spec §6). */
  async forceRelease(lockId: string): Promise<SlotLockDto | null> {
    const row = await this.prisma.slotLock.findUnique({
      where: { id: lockId },
      include: { salesRep: userRefSelect, lockedBy: userRefSelect },
    });
    if (!row) {
      return null;
    }
    await this.prisma.slotLock.delete({ where: { id: lockId } });
    return this.toDto(row, '');
  }

  private conflictingLock(
    db: Db,
    salesRepId: string,
    startsAt: Date,
    endsAt: Date,
    actorId: string,
  ) {
    return db.slotLock.findFirst({
      where: {
        salesRepId,
        lockedById: { not: actorId },
        expiresAt: { gte: this.clock.now() },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      include: { lockedBy: userRefSelect },
    });
  }

  private toDto(
    row: Prisma.SlotLockGetPayload<{
      include: { salesRep: typeof userRefSelect; lockedBy: typeof userRefSelect };
    }>,
    actorId: string,
  ): SlotLockDto {
    return {
      id: row.id,
      salesRep: userRef(row.salesRep),
      lockedBy: userRef(row.lockedBy),
      startsAt: iso(row.startsAt),
      endsAt: iso(row.endsAt),
      expiresAt: iso(row.expiresAt),
      isMine: row.lockedById === actorId,
    };
  }
}
