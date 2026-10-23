import type {
  NoticeCode,
  NotificationDto,
  NotificationListResponse,
  NotificationQuery,
} from '@telesales/shared';
import type { Logger } from 'pino';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { iso } from '../../http/mappers.js';
import type { EmailService } from './EmailService.js';
import type { NoticeContext, RecipientResolver } from './RecipientResolver.js';

export interface NoticeEvent {
  code: NoticeCode;
  context?: NoticeContext;
  title: string;
  body?: string;
  linkPath?: string;
  /** The person who caused the event does not need to be told about it. */
  actorId?: string | null;
  /** Scheduled reminders: each person gets a notice with the same key only once. */
  dedupeKey?: string;
  /** Sent only when the notice is configured to also send e-mail. */
  email?: { subject: string; text: string; dedupeKey: string; appointmentId?: string | null };
}

/**
 * On-screen notices (the bell) plus optional e-mail, with recipients taken from the
 * admin settings. A failure to notify never breaks the user's action.
 */
export class NotificationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly recipients: RecipientResolver,
    private readonly emails: EmailService,
    private readonly logger: Logger,
  ) {}

  async notify(event: NoticeEvent): Promise<void> {
    try {
      const resolved = await this.recipients.resolve(event.code, event.context);
      if (!resolved.enabled) {
        return;
      }
      const userIds = resolved.userIds.filter((id) => id !== event.actorId);
      if (userIds.length > 0) {
        await this.prisma.notification.createMany({
          data: userIds.map((userId) => this.row(userId, event)),
          skipDuplicates: true,
        });
      }
      if (resolved.sendsEmail && event.email) {
        await this.emails.sendDirect({
          noticeCode: event.code,
          dedupeKey: event.email.dedupeKey,
          appointmentId: event.email.appointmentId ?? null,
          to: resolved.to,
          cc: resolved.cc,
          subject: event.email.subject,
          body: event.email.text,
          createdById: event.actorId ?? null,
        });
      }
    } catch (error) {
      this.logger.error({ err: error, code: event.code }, 'failed to deliver notice');
    }
  }

  /** On-screen notice to specific people, regardless of the configured recipients. */
  async notifyUsers(
    userIds: readonly string[],
    event: Pick<NoticeEvent, 'code' | 'title' | 'body' | 'linkPath' | 'actorId' | 'dedupeKey'>,
  ): Promise<void> {
    const targets = [...new Set(userIds)].filter((id) => id && id !== event.actorId);
    if (targets.length === 0) {
      return;
    }
    try {
      const setting = await this.prisma.noticeSetting.findUnique({ where: { code: event.code } });
      if (setting && !setting.isEnabled) {
        return;
      }
      await this.prisma.notification.createMany({
        data: targets.map((userId) => this.row(userId, event)),
        skipDuplicates: true,
      });
    } catch (error) {
      this.logger.error({ err: error, code: event.code }, 'failed to deliver notice');
    }
  }

  private row(
    userId: string,
    event: Pick<NoticeEvent, 'code' | 'title' | 'body' | 'linkPath' | 'dedupeKey'>,
  ) {
    return {
      userId,
      noticeCode: event.code,
      title: event.title.slice(0, 200),
      body: event.body?.slice(0, 500) ?? null,
      linkPath: event.linkPath ?? null,
      dedupeKey: event.dedupeKey ?? null,
    };
  }

  async listFor(userId: string, query?: Partial<NotificationQuery>): Promise<NotificationListResponse> {
    const box = query?.box ?? 'inbox';
    const limit = query?.limit ?? 50;
    const q = query?.q?.trim();
    const where: Prisma.NotificationWhereInput = {
      userId,
      archivedAt: box === 'archived' ? { not: null } : null,
      ...(box === 'unread' ? { readAt: null } : {}),
      ...(query?.codes?.length ? { noticeCode: { in: query.codes } } : {}),
      ...(query?.before ? { createdAt: { lt: new Date(query.before) } } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' as const } },
              { body: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, unreadCount, byCode] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null, archivedAt: null } }),
      this.prisma.notification.groupBy({
        by: ['noticeCode'],
        where: { userId, readAt: null, archivedAt: null },
        _count: { _all: true },
      }),
    ]);
    const page = rows.slice(0, limit);
    const items: NotificationDto[] = page.map((row) => ({
      id: row.id,
      noticeCode: row.noticeCode,
      title: row.title,
      body: row.body,
      linkPath: row.linkPath,
      readAt: iso(row.readAt),
      archivedAt: iso(row.archivedAt),
      createdAt: iso(row.createdAt),
    }));
    return {
      items,
      unreadCount,
      nextCursor: rows.length > limit ? iso(page[page.length - 1]?.createdAt) : null,
      unreadByCode: Object.fromEntries(byCode.map((row) => [row.noticeCode, row._count._all])),
    };
  }

  async markRead(userId: string, ids: string[] | 'all'): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids === 'all' ? {} : { id: { in: ids } }) },
      data: { readAt: new Date() },
    });
  }

  async markUnread(userId: string, ids: string[]): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, id: { in: ids } },
      data: { readAt: null },
    });
  }

  /** Archiving also marks as read, as in Teams; restoring puts it back in the inbox. */
  async setArchived(userId: string, ids: string[] | 'read', archived: boolean): Promise<void> {
    const now = new Date();
    await this.prisma.notification.updateMany({
      where: {
        userId,
        ...(ids === 'read' ? { readAt: { not: null }, archivedAt: null } : { id: { in: ids } }),
      },
      data: archived ? { archivedAt: now, readAt: now } : { archivedAt: null },
    });
  }
}
