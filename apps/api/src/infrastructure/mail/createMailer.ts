import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Logger } from 'pino';
import type { MailConfig } from '../../config/AppConfig.js';
import type { Mailer, MailMessage } from '../../domain/mail/Mailer.js';

class TransportMailer implements Mailer {
  constructor(
    private readonly transporter: Transporter,
    private readonly from: string,
    private readonly afterSend?: (raw: Buffer, message: MailMessage) => Promise<void>,
  ) {}

  async send(message: MailMessage): Promise<void> {
    const info: { message?: unknown } = await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      cc: message.cc,
      subject: message.subject,
      text: message.text,
      attachments: message.attachments?.map((file) => ({
        filename: file.filename,
        content: file.content,
        contentType: file.contentType,
      })),
    });
    if (this.afterSend && Buffer.isBuffer(info.message)) {
      await this.afterSend(info.message, message);
    }
  }
}

/** `Name <a@b.jp>` or `a@b.jp` → `a@b.jp`, lower-case. */
function addressOf(recipient: string): string {
  return (/<([^>]+)>/.exec(recipient)?.[1] ?? recipient).trim().toLowerCase();
}

/** Whether an address matches the allowlist (exact address or `@domain`). */
export function isAllowedRecipient(recipient: string, allowed: readonly string[]): boolean {
  const address = addressOf(recipient);
  return allowed.some((entry) =>
    entry.startsWith('@') ? address.endsWith(entry) : address === entry,
  );
}

/**
 * Sends only to allowlisted recipients; the rest are left out. A mail with nobody
 * left goes to the outbox in full, so it can still be checked.
 */
export class AllowlistMailer implements Mailer {
  constructor(
    private readonly inner: Mailer,
    private readonly outbox: Mailer,
    private readonly allowed: readonly string[],
    private readonly logger: Logger,
  ) {}

  async send(message: MailMessage): Promise<void> {
    const keep = (list: string[]) => list.filter((r) => isAllowedRecipient(r, this.allowed));
    const to = keep(message.to);
    const cc = keep(message.cc);
    const held = [...message.to, ...message.cc].filter((r) => !isAllowedRecipient(r, this.allowed));
    if (held.length > 0) {
      this.logger.info({ held, subject: message.subject }, 'recipients outside the mail allowlist');
    }
    if (to.length + cc.length === 0) {
      await this.outbox.send(message);
      return;
    }
    // Someone allowed is only on CC: promote them, a mail needs a To.
    await this.inner.send(to.length > 0 ? { ...message, to, cc } : { ...message, to: cc, cc: [] });
  }
}

/**
 * SMTP when configured; otherwise every mail is rendered to an .eml file in
 * `<storageDir>/outbox` so the exact format can be checked without sending anything.
 * With an allowlist, SMTP is used only for the allowed recipients.
 */
export function createMailer(config: MailConfig, storageDir: string, logger: Logger): Mailer {
  const outbox = outboxMailer(config, storageDir, logger);
  if (!config.smtpUrl) {
    return outbox;
  }
  const smtp = new TransportMailer(nodemailer.createTransport(config.smtpUrl), config.from);
  return config.allowedRecipients.length > 0
    ? new AllowlistMailer(smtp, outbox, config.allowedRecipients, logger)
    : smtp;
}

function outboxMailer(config: MailConfig, storageDir: string, logger: Logger): Mailer {
  const outbox = path.resolve(storageDir, 'outbox');
  return new TransportMailer(
    nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' }),
    config.from,
    async (raw, message) => {
      await mkdir(outbox, { recursive: true });
      const file = path.join(outbox, `${new Date().toISOString().replace(/[:.]/g, '-')}.eml`);
      await writeFile(file, raw);
      logger.info({ file, to: message.to, subject: message.subject }, 'mail written to outbox');
    },
  );
}
