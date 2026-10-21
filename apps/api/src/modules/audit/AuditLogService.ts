import { type AuditLogQuery, type AuditLogResponse, jstDate } from '@telesales/shared';
import { AuditChanges } from '../../domain/audit/AuditChanges.js';
import type { Clock } from '../../domain/Clock.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { iso, userRef } from '../../http/mappers.js';

/** The screen covers this many days back; older history is extracted on request (Q-09). */
export const AUDIT_SCREEN_DAYS = 90;
const DEFAULT_DAYS = 7;
const MAX_ROWS = 300;
const DAY_MS = 24 * 60 * 60 * 1000;

/** JST midnight of a 'YYYY-MM-DD' date, as an instant. */
function startOfJstDay(date: string): Date {
  return new Date(`${date}T00:00:00+09:00`);
}

/**
 * Recent operation history for admins (Q-09, 10/20): who did what and when, with the
 * fields that changed. Logins and e-mails are recorded too; the screen filters by target.
 */
export class AuditLogService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clock: Clock,
  ) {}

  async recent(query: AuditLogQuery): Promise<AuditLogResponse> {
    const now = this.clock.now();
    const today = jstDate(now);
    const earliest = new Date(startOfJstDay(today).getTime() - (AUDIT_SCREEN_DAYS - 1) * DAY_MS);
    const defaultFrom = new Date(startOfJstDay(today).getTime() - (DEFAULT_DAYS - 1) * DAY_MS);
    const from = query.from ? startOfJstDay(query.from) : defaultFrom;
    const to = query.to ? new Date(startOfJstDay(query.to).getTime() + DAY_MS) : undefined;

    const rows = await this.prisma.auditLog.findMany({
      where: {
        createdAt: { gte: from < earliest ? earliest : from, ...(to ? { lt: to } : {}) },
        ...(query.targetType ? { targetType: query.targetType } : {}),
        ...(query.actorId ? { actorUserId: query.actorId } : {}),
      },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS + 1,
    });
    const shown = rows.slice(0, MAX_ROWS);

    const ids = AuditChanges.ids(...shown.flatMap((row) => [row.before, row.after]));
    const people = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const changes = new AuditChanges(new Map(people.map((person) => [person.id, person.name])));

    return {
      items: shown.map((row) => ({
        id: row.id.toString(),
        createdAt: iso(row.createdAt),
        actor: userRef(row.actor),
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        changes: changes.between(row.before, row.after),
      })),
      truncated: rows.length > MAX_ROWS,
      days: AUDIT_SCREEN_DAYS,
    };
  }
}
