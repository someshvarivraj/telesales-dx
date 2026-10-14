import {
  type AuditLogDto,
  isRole,
  type NoticeRecipientDto,
  type NoticeSettingDto,
  RecipientContext,
  RecipientKind,
} from '@telesales/shared';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { ConflictError, NotFoundError, ValidationError } from '../../http/errors/AppError.js';
import { iso, userRef } from '../../http/mappers.js';

const ROLE_LABEL: Record<string, string> = {
  TELEMA: 'テレマ全員',
  TELEMA_LEAD: 'リーダー全員',
  SALES: '営業全員',
  VIEWER: '閲覧の全員',
  ADMIN: '管理者全員',
};

const CONTEXT_LABEL: Record<RecipientContext, string> = {
  [RecipientContext.AssignedRep]: '担当営業',
  [RecipientContext.AssignedRepBefore]: '変更前の担当営業',
  [RecipientContext.Booker]: 'アポを取ったテレマ',
  [RecipientContext.Attendees]: '同席者',
  [RecipientContext.PlanOwner]: '予定の持ち主',
  [RecipientContext.Assignee]: '割り振りの担当',
  [RecipientContext.RecordAuthor]: '記録を書いた人',
  [RecipientContext.Thread]: '同じスレッドの人',
};

/** Notice settings and recipients (spec §8: recipients, days and times are data, never code). */
export class NoticeSettingsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditLogger,
  ) {}

  async list(): Promise<NoticeSettingDto[]> {
    const rows = await this.prisma.noticeSetting.findMany({
      include: { recipients: { orderBy: { createdAt: 'asc' } } },
    });
    const userIds = rows.flatMap((row) =>
      row.recipients.filter((r) => r.kind === RecipientKind.User).map((r) => r.value),
    );
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userName = new Map(users.map((user) => [user.id, user.name]));
    const order = (code: string) => Number(code.slice(1));
    return rows
      .sort((a, b) => order(a.code) - order(b.code))
      .map((row) => ({
        code: row.code,
        name: row.name,
        isEnabled: row.isEnabled,
        sendsEmail: row.sendsEmail,
        sendTime: row.sendTime,
        daysBefore: row.daysBefore,
        recipients: row.recipients.map((recipient): NoticeRecipientDto => ({
          id: recipient.id,
          field: recipient.field,
          kind: recipient.kind,
          value: recipient.value,
          label:
            recipient.kind === RecipientKind.Email
              ? recipient.value
              : recipient.kind === RecipientKind.User
                ? (userName.get(recipient.value) ?? '（削除されたユーザー）')
                : recipient.kind === RecipientKind.Role
                  ? (ROLE_LABEL[recipient.value] ?? recipient.value)
                  : (CONTEXT_LABEL[recipient.value as RecipientContext] ?? recipient.value),
        })),
      }));
  }

  async update(
    actor: Actor,
    code: string,
    input: {
      isEnabled: boolean;
      sendsEmail: boolean;
      sendTime?: string | null;
      daysBefore: number[];
    },
  ): Promise<NoticeSettingDto> {
    const before = await this.prisma.noticeSetting.findUnique({ where: { code } });
    if (!before) {
      throw new NotFoundError();
    }
    await this.prisma.noticeSetting.update({
      where: { code },
      data: {
        isEnabled: input.isEnabled,
        sendsEmail: input.sendsEmail,
        sendTime: input.sendTime ?? null,
        daysBefore: input.daysBefore,
      },
    });
    await this.audit.record({
      action: AuditAction.SettingsChanged,
      actorUserId: actor.id,
      targetType: 'notice_setting',
      targetId: code,
      before: {
        isEnabled: before.isEnabled,
        sendsEmail: before.sendsEmail,
        sendTime: before.sendTime,
        daysBefore: before.daysBefore,
      },
      after: { ...input },
    });
    return this.find(code);
  }

  async addRecipient(
    actor: Actor,
    code: string,
    input: { field: 'TO' | 'CC'; kind: RecipientKind; value: string },
  ): Promise<NoticeSettingDto> {
    const value =
      input.kind === RecipientKind.Email ? input.value.trim().toLowerCase() : input.value.trim();
    if (input.kind === RecipientKind.Email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new ValidationError({ value: ['invalid_email'] });
    }
    if (input.kind === RecipientKind.Role && !isRole(value)) {
      throw new ValidationError({ value: ['invalid_role'] });
    }
    if (input.kind === RecipientKind.Context && !(value in CONTEXT_LABEL)) {
      throw new ValidationError({ value: ['invalid_context'] });
    }
    if (
      input.kind === RecipientKind.User &&
      !(await this.prisma.user.findUnique({ where: { id: value }, select: { id: true } }))
    ) {
      throw new ValidationError({ value: ['invalid_user'] });
    }
    const exists = await this.prisma.noticeRecipient.findFirst({
      where: { noticeCode: code, field: input.field, kind: input.kind, value },
    });
    if (exists) {
      throw new ConflictError({ reason: 'already_added' });
    }
    await this.prisma.noticeRecipient.create({
      data: { noticeCode: code, field: input.field, kind: input.kind, value },
    });
    await this.audit.record({
      action: AuditAction.SettingsChanged,
      actorUserId: actor.id,
      targetType: 'notice_recipient',
      targetId: code,
      after: { field: input.field, kind: input.kind, value },
    });
    return this.find(code);
  }

  async removeRecipient(
    actor: Actor,
    code: string,
    recipientId: string,
  ): Promise<NoticeSettingDto> {
    const recipient = await this.prisma.noticeRecipient.findFirst({
      where: { id: recipientId, noticeCode: code },
    });
    if (!recipient) {
      throw new NotFoundError();
    }
    await this.prisma.noticeRecipient.delete({ where: { id: recipientId } });
    await this.audit.record({
      action: AuditAction.SettingsChanged,
      actorUserId: actor.id,
      targetType: 'notice_recipient',
      targetId: code,
      before: { field: recipient.field, kind: recipient.kind, value: recipient.value },
    });
    return this.find(code);
  }

  async auditLog(filter: {
    targetType?: string;
    targetId?: string;
    limit: number;
  }): Promise<AuditLogDto[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(filter.targetType ? { targetType: filter.targetType } : {}),
        ...(filter.targetId ? { targetId: filter.targetId } : {}),
      },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: filter.limit,
    });
    return rows.map((row) => ({
      id: row.id.toString(),
      actor: userRef(row.actor),
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      before: row.before,
      after: row.after,
      createdAt: iso(row.createdAt),
    }));
  }

  private async find(code: string): Promise<NoticeSettingDto> {
    const all = await this.list();
    const found = all.find((setting) => setting.code === code);
    if (!found) {
      throw new NotFoundError();
    }
    return found;
  }
}
