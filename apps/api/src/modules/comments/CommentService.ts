import { type CommentDto, type CreateCommentRequest, NoticeCode } from '@telesales/shared';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { NotFoundError, ValidationError } from '../../http/errors/AppError.js';
import { iso, userRef, userRefSelect } from '../../http/mappers.js';
import type { NotificationService } from '../notifications/NotificationService.js';

interface Target {
  appointmentId?: string | null;
  callRecordId?: string | null;
}

function targetWhere(target: Target): { appointmentId: string } | { callRecordId: string } {
  if (target.appointmentId) {
    return { appointmentId: target.appointmentId };
  }
  if (target.callRecordId) {
    return { callRecordId: target.callRecordId };
  }
  throw new ValidationError({ appointmentId: ['required'] });
}

/**
 * Questions and comments on appointments and call records (spec §6). Pre-meeting
 * discussion with the DX team happens here too. Everyone involved is told (N18).
 */
export class CommentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly notifications: NotificationService,
  ) {}

  async list(target: Target): Promise<CommentDto[]> {
    const rows = await this.prisma.comment.findMany({
      where: { deletedAt: null, ...targetWhere(target) },
      include: { author: userRefSelect },
      orderBy: { createdAt: 'asc' },
    });
    const byId = new Map<string, CommentDto>();
    const roots: CommentDto[] = [];
    for (const row of rows) {
      byId.set(row.id, {
        id: row.id,
        parentId: row.parentId,
        author: userRef(row.author),
        body: row.body,
        createdAt: iso(row.createdAt),
        replies: [],
      });
    }
    for (const comment of byId.values()) {
      const parent = comment.parentId ? byId.get(comment.parentId) : undefined;
      (parent ? parent.replies : roots).push(comment);
    }
    return roots;
  }

  async create(actor: Actor, input: CreateCommentRequest): Promise<CommentDto> {
    const context = await this.contextFor(input);
    let parentId: string | null = null;
    if (input.parentId) {
      const parent = await this.prisma.comment.findUnique({ where: { id: input.parentId } });
      if (
        !parent ||
        parent.appointmentId !== (input.appointmentId ?? null) ||
        parent.callRecordId !== (input.callRecordId ?? null)
      ) {
        throw new NotFoundError();
      }
      // Replies attach to the thread's first comment so threads stay one level deep.
      parentId = parent.parentId ?? parent.id;
    }
    const row = await this.prisma.comment.create({
      data: {
        appointmentId: input.appointmentId ?? null,
        callRecordId: input.callRecordId ?? null,
        parentId,
        authorId: actor.id,
        body: input.body,
      },
      include: { author: userRefSelect },
    });

    const threadAuthors = await this.prisma.comment.findMany({
      where: {
        deletedAt: null,
        ...targetWhere(input),
        ...(parentId ? { OR: [{ id: parentId }, { parentId }] } : {}),
      },
      select: { authorId: true },
      distinct: ['authorId'],
    });
    await this.notifications.notify({
      code: NoticeCode.Commented,
      title: `${row.author.name}さんがコメントしました：${context.title}`,
      body: input.body.slice(0, 200),
      linkPath: context.linkPath,
      actorId: actor.id,
      context: {
        RECORD_AUTHOR: [context.recordAuthorId],
        ASSIGNED_REP: [context.salesRepId],
        THREAD: threadAuthors.map((comment) => comment.authorId),
      },
    });

    return {
      id: row.id,
      parentId: row.parentId,
      author: userRef(row.author),
      body: row.body,
      createdAt: iso(row.createdAt),
      replies: [],
    };
  }

  private async contextFor(input: CreateCommentRequest) {
    if (input.appointmentId) {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: input.appointmentId },
        select: {
          id: true,
          bookedById: true,
          salesRepId: true,
          company: { select: { name: true } },
        },
      });
      if (!appointment) {
        throw new NotFoundError();
      }
      return {
        title: appointment.company.name,
        linkPath: `/appointments/${appointment.id}`,
        recordAuthorId: appointment.bookedById,
        salesRepId: appointment.salesRepId,
      };
    }
    if (!input.callRecordId) {
      throw new ValidationError({ callRecordId: ['required'] });
    }
    const record = await this.prisma.callRecord.findUnique({
      where: { id: input.callRecordId },
      select: { telemarketerId: true, company: { select: { id: true, name: true } } },
    });
    if (!record) {
      throw new NotFoundError();
    }
    return {
      title: `${record.company.name}（架電記録）`,
      linkPath: `/calls/companies/${record.company.id}`,
      recordAuthorId: record.telemarketerId,
      salesRepId: null,
    };
  }
}
