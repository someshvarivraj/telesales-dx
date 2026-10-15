import type { NoticeCode, NotificationDto, NotificationListResponse } from '@telesales/shared';
import type { Logger } from 'pino';
import type { PrismaClient } from '../../generated/prisma/client.js';
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

  async listFor(userId: string, limit = 50): Promise<NotificationListResponse> {
    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    const items: NotificationDto[] = rows.map((row) => ({
      id: row.id,
      noticeCode: row.noticeCode,
      title: row.title,
      linkPath: row.linkPath,
      readAt: iso(row.readAt),
      createdAt: iso(row.createdAt),
    }));
    return { items, unreadCount };
  }

  async markRead(userId: string, ids: string[] | 'all'): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids === 'all' ? {} : { id: { in: ids } }) },
      data: { readAt: new Date() },
    });
  }
}
