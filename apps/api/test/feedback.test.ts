import { NoticeCode, updateFeedbackRequestSchema } from '@telesales/shared';
import { describe, expect, it } from 'vitest';
import type { Actor } from '../src/domain/access/AccessPolicy.js';
import type { AuditLogger } from '../src/domain/audit/AuditLogger.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { FeedbackService } from '../src/modules/feedback/FeedbackService.js';
import type {
  NoticeEvent,
  NotificationService,
} from '../src/modules/notifications/NotificationService.js';

const actor = { id: 'u1' } as Actor;
const admin = { id: 'a1' } as Actor;

function setup() {
  const rows = new Map<string, Record<string, unknown>>();
  const notices: NoticeEvent[] = [];
  const direct: unknown[][] = [];
  const withPeople = (row: Record<string, unknown>) => ({
    ...row,
    reporter: { id: row.reporterId, name: '山田 太郎' },
    handledBy: row.handledById ? { id: row.handledById, name: '管理者' } : null,
  });
  const prisma = {
    feedback: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: 'f1',
          number: 7,
          status: 'OPEN',
          note: null,
          resolution: null,
          handledById: null,
          createdAt: new Date('2026-10-30T01:00:00Z'),
          updatedAt: new Date('2026-10-30T01:00:00Z'),
          resolvedAt: null,
          ...data,
        };
        rows.set(row.id, row);
        return withPeople(row);
      },
      findUnique: async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = { ...rows.get(where.id), ...data };
        rows.set(where.id, row);
        return withPeople(row);
      },
    },
  } as unknown as PrismaClient;
  const notifications = {
    notify: async (event: NoticeEvent) => void notices.push(event),
    notifyUsers: async (...args: unknown[]) => void direct.push(args),
  } as unknown as NotificationService;
  const audit = { record: async () => undefined } as unknown as AuditLogger;
  const service = new FeedbackService(prisma, notifications, audit, 'https://app.example');
  return { service, notices, direct };
}

describe('ご意見・不具合の報告', () => {
  it('records the sender and screen and mails 「架電システム：種類」 to N20 and the sender', async () => {
    const { service, notices } = setup();
    const dto = await service.create(actor, {
      type: 'BUG',
      body: '保存ボタンが押せません',
      screenPath: '/schedule?date=2026-10-30',
      screenName: 'スケジュール',
    });
    expect(dto).toMatchObject({ number: 7, status: 'OPEN', reporter: { id: 'u1' } });
    expect(notices).toHaveLength(1);
    const [notice] = notices;
    expect(notice?.code).toBe(NoticeCode.Feedback);
    expect(notice?.context).toEqual({ REPORTER: ['u1'] });
    expect(notice?.email?.subject).toBe('架電システム：不具合');
    expect(notice?.email?.text).toContain('保存ボタンが押せません');
    expect(notice?.email?.text).toContain('送った人: 山田 太郎');
    expect(notice?.email?.text).toContain('日時: ');
    expect(notice?.email?.text).toContain(
      '画面: スケジュール（https://app.example/schedule?date=2026-10-30）',
    );
  });

  it('keeps only in-app paths', async () => {
    const { service } = setup();
    const dto = await service.create(actor, {
      type: 'OTHER',
      body: 'x',
      screenPath: 'https://evil.example/',
    });
    expect(dto.screenPath).toBe('/');
  });

  it('mails what was done to the same people when resolved, once', async () => {
    const { service, notices, direct } = setup();
    await service.create(actor, { type: 'REQUEST', body: '並び替えたい', screenPath: '/home' });
    await service.update(admin, 'f1', { status: 'WAITING_DECISION', note: '仕様の確認' });
    expect(direct).toHaveLength(1);
    expect(notices).toHaveLength(1);

    await service.update(admin, 'f1', { status: 'RESOLVED', resolution: '並び替えを追加しました' });
    expect(notices).toHaveLength(2);
    const resolved = notices[1];
    expect(resolved?.context).toEqual({ REPORTER: ['u1'] });
    expect(resolved?.email?.subject).toBe('架電システム：要望・提案（対応済み）');
    expect(resolved?.email?.text).toContain('並び替えを追加しました');
    expect(resolved?.email?.text).toContain('並び替えたい');

    // Saving again (e.g. fixing the note) does not mail everyone a second time.
    await service.update(admin, 'f1', { status: 'RESOLVED', resolution: '並び替えを追加しました' });
    expect(notices).toHaveLength(2);
  });

  it('needs what was done before it can be resolved', () => {
    expect(updateFeedbackRequestSchema.safeParse({ status: 'RESOLVED' }).success).toBe(false);
    expect(
      updateFeedbackRequestSchema.safeParse({ status: 'RESOLVED', resolution: '直しました' })
        .success,
    ).toBe(true);
  });
});
