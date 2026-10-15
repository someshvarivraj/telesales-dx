export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface MailMessage {
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  attachments?: MailAttachment[];
}

/** Sends e-mail. SMTP (e.g. Amazon SES) in production; an .eml outbox in development. */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}
