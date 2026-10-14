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

/**
 * SMTP when configured; otherwise every mail is rendered to an .eml file in
 * `<storageDir>/outbox` so the exact format can be checked without sending anything.
 */
export function createMailer(config: MailConfig, storageDir: string, logger: Logger): Mailer {
  if (config.smtpUrl) {
    return new TransportMailer(nodemailer.createTransport(config.smtpUrl), config.from);
  }
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
