import { jstDate, type NextActionDto } from '@telesales/shared';
import type { AccessPolicy, Actor } from '../../domain/access/AccessPolicy.js';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { Clock } from '../../domain/Clock.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { ForbiddenError, NotFoundError } from '../../http/errors/AppError.js';
import { dateOnly, iso, toDbDate, userRef, userRefSelect } from '../../http/mappers.js';

/** Next actions that are mine: I wrote the result, or the appointment is assigned to me. */
function mineWhere(userId: string): Prisma.MeetingResultWhereInput {
  return {
    nextAction: { not: null },
    OR: [{ authorId: userId }, { appointment: { salesRepId: userId } }],
  };
}

/** A rep's own next actions from meeting results (spec §6, priority 2). */
export class NextActionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly policy: AccessPolicy,
    private readonly audit: AuditLogger,
    private readonly clock: Clock,
  ) {}

  async listMine(actor: Actor, includeDone: boolean): Promise<NextActionDto[]> {
    const rows = await this.prisma.meetingResult.findMany({
      where: { ...mineWhere(actor.id), ...(includeDone ? {} : { nextActionDoneAt: null }) },
      include: {
        author: userRefSelect,
        appointment: { select: { id: true, company: { select: { id: true, name: true } } } },
      },
      orderBy: [{ nextActionDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 300,
    });
    return rows.map((row) => ({
      resultId: row.id,
      appointmentId: row.appointment.id,
      company: row.appointment.company,
      visitedOn: dateOnly(row.visitedOn),
      nextAction: row.nextAction ?? '',
      nextActionDate: dateOnly(row.nextActionDate),
      doneAt: iso(row.nextActionDoneAt),
      author: userRef(row.author),
    }));
  }

  /** Open next actions due today or earlier (home screen). */
  async dueCount(userId: string): Promise<number> {
    return this.prisma.meetingResult.count({
      where: {
        ...mineWhere(userId),
        nextActionDoneAt: null,
        nextActionDate: { lte: toDbDate(jstDate(this.clock.now())) },
      },
    });
  }

  async setDone(actor: Actor, resultId: string, done: boolean): Promise<void> {
    const row = await this.prisma.meetingResult.findUnique({
      where: { id: resultId },
      select: {
        id: true,
        authorId: true,
        nextAction: true,
        appointment: { select: { salesRepId: true } },
      },
    });
    if (!row || !row.nextAction) {
      throw new NotFoundError();
    }
    const own = row.authorId === actor.id || row.appointment.salesRepId === actor.id;
    if (!own && !this.policy.isAdmin(actor)) {
      throw new ForbiddenError();
    }
    const doneAt = done ? this.clock.now() : null;
    await this.prisma.meetingResult.update({
      where: { id: resultId },
      data: { nextActionDoneAt: doneAt },
    });
    await this.audit.record({
      action: AuditAction.NextActionUpdated,
      actorUserId: actor.id,
      targetType: 'meeting_result',
      targetId: resultId,
      after: { done },
    });
  }
}
