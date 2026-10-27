import pino from 'pino';
import { describe, expect, it } from 'vitest';
import type { Mailer, MailMessage } from '../src/domain/mail/Mailer.js';
import { AllowlistMailer, isAllowedRecipient } from '../src/infrastructure/mail/createMailer.js';

class Recorder implements Mailer {
  sent: MailMessage[] = [];
  async send(message: MailMessage) {
    this.sent.push(message);
  }
}

const message = (to: string[], cc: string[] = []): MailMessage => ({
  to,
  cc,
  subject: 'アポ登録のお知らせ',
  text: '本文',
});

function setup(allowed: string[]) {
  const smtp = new Recorder();
  const outbox = new Recorder();
  const mailer = new AllowlistMailer(smtp, outbox, allowed, pino({ level: 'silent' }));
  return { smtp, outbox, mailer };
}

describe('mail allowlist', () => {
  it('matches exact addresses and @domains, ignoring case and display names', () => {
    const allowed = ['tester@example.jp', '@test.example'];
    expect(isAllowedRecipient('Tester@Example.jp', allowed)).toBe(true);
    expect(isAllowedRecipient('山田 <yamada@test.example>', allowed)).toBe(true);
    expect(isAllowedRecipient('other@example.jp', allowed)).toBe(false);
    expect(isAllowedRecipient('a@nottest.example.jp', allowed)).toBe(false);
  });

  it('sends only to allowed recipients', async () => {
    const { smtp, outbox, mailer } = setup(['tester@example.jp']);
    await mailer.send(message(['tester@example.jp', 'team@example.jp'], ['boss@example.jp']));
    expect(smtp.sent).toEqual([expect.objectContaining({ to: ['tester@example.jp'], cc: [] })]);
    expect(outbox.sent).toHaveLength(0);
  });

  it('moves an allowed CC to To when no To is allowed', async () => {
    const { smtp, mailer } = setup(['tester@example.jp']);
    await mailer.send(message(['team@example.jp'], ['tester@example.jp']));
    expect(smtp.sent[0]).toEqual(expect.objectContaining({ to: ['tester@example.jp'], cc: [] }));
  });

  it('keeps the whole mail in the outbox when nobody is allowed', async () => {
    const { smtp, outbox, mailer } = setup(['tester@example.jp']);
    const mail = message(['team@example.jp']);
    await mailer.send(mail);
    expect(smtp.sent).toHaveLength(0);
    expect(outbox.sent).toEqual([mail]);
  });
});
