import { NoticeCode } from '@telesales/shared';
import type { Logger } from 'pino';
import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { DirectEmailInput, EmailService } from '../src/modules/notifications/EmailService.js';
import { NotificationService } from '../src/modules/notifications/NotificationService.js';
import type { RecipientResolver } from '../src/modules/notifications/RecipientResolver.js';

const EMAILS: Record<string, string> = {
  a: 'a@morabu.com',
  b: 'b@morabu.com',
  me: 'me@morabu.com',
};

function setup({ sendsEmail = true } = {}) {
  const sent: DirectEmailInput[] = [];
  const prisma = {
    notification: { createMany: async () => ({ count: 1 }) },
    noticeSetting: { findUnique: async () => ({ isEnabled: true, sendsEmail }) },
    user: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => ({ email: EMAILS[id] })),
    },
  } as unknown as PrismaClient;
  const recipients = {
    resolve: async () => ({
      enabled: true,
      sendsEmail,
      userIds: ['a', 'me'],
      to: ['a@morabu.com', 'me@morabu.com'],
      cc: ['b@morabu.com'],
    }),
  } as unknown as RecipientResolver;
  const emails = {
    sendDirect: async (input: DirectEmailInput) => {
      sent.push(input);
      return true;
    },
  } as unknown as EmailService;
  const logger = { error: () => undefined } as unknown as Logger;
  const service = new NotificationService(
    prisma,
    recipients,
    emails,
    logger,
    'https://dx.morabu.com/telesales-dx-staging/',
  );
  return { service, sent };
}

describe('every notice can be mailed (request 11/11)', () => {
  it('mails a notice with no e-mail of its own: title, text and a link', async () => {
    const { service, sent } = setup();
    await service.notify({
      code: NoticeCode.Commented,
      title: 'アポにコメントが付きました',
      body: '明日の件、資料を持参します',
      linkPath: '/appointments/x1',
      actorId: 'me',
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toEqual(['a@morabu.com']);
    expect(sent[0]?.cc).toEqual(['b@morabu.com']);
    expect(sent[0]?.subject).toBe('架電システム：アポにコメントが付きました');
    expect(sent[0]?.body).toContain('https://dx.morabu.com/telesales-dx-staging/appointments/x1');
  });

  it('mails the people a notice is sent to directly', async () => {
    const { service, sent } = setup();
    await service.notifyUsers(['a', 'b'], {
      code: NoticeCode.ChangeRequested,
      title: '変更依頼が届きました',
      dedupeKey: 'r1',
    });
    expect(sent[0]?.to).toEqual(['a@morabu.com', 'b@morabu.com']);
    expect(sent[0]?.dedupeKey).toBe('notice:N7:r1');
  });

  it('does not mail twice for notices that write their own e-mail', async () => {
    const { service, sent } = setup();
    await service.notifyUsers(['a'], { code: NoticeCode.Booking, title: 'アポが入りました' });
    await service.notifyUsers(['a'], {
      code: NoticeCode.TomorrowAppointments,
      title: '明日のアポ',
    });
    expect(sent).toHaveLength(0);
  });

  it('sends nothing when the notice is 画面のみ', async () => {
    const { service, sent } = setup({ sendsEmail: false });
    await service.notify({ code: NoticeCode.Commented, title: 'x', actorId: 'me' });
    await service.notifyUsers(['a'], { code: NoticeCode.ChangeRequested, title: 'y' });
    expect(sent).toHaveLength(0);
  });
});
