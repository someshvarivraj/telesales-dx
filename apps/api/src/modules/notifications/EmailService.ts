import {
  type EmailDraftDto,
  EmailStatus,
  type NoticeCode,
  Role,
  stampAutomatic,
  stampOperator,
} from '@telesales/shared';
import type { Logger } from 'pino';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import type { MailAttachment, Mailer } from '../../domain/mail/Mailer.js';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { InvalidStateError, NotFoundError } from '../../http/errors/AppError.js';
import { iso } from '../../http/mappers.js';
import type { FileService } from '../files/FileService.js';

export interface DraftInput {
  noticeCode: NoticeCode;
  /** One logical e-mail = one key. The same key is never sent twice (spec §2-13). */
  dedupeKey: string;
  appointmentId?: string | null;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  createdById: string;
}

export interface DirectEmailInput extends Omit<DraftInput, 'createdById'> {
  createdById?: string | null;
  attachments?: (MailAttachment & { fileId?: string })[];
}

interface EmailRow {
  id: string;
  noticeCode: string;
  appointmentId: string | null;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  status: EmailStatus;
  sentAt: Date | null;
}

export function toEmailDraftDto(row: EmailRow): EmailDraftDto {
  return {
    id: row.id,
    noticeCode: row.noticeCode,
    appointmentId: row.appointmentId,
    to: row.to,
    cc: row.cc,
    subject: row.subject,
    body: row.body,
    status: row.status,
    sentAt: iso(row.sentAt),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Every outgoing e-mail goes through here. "Preview then send" e-mails (N1, N8, N14)
 * start as drafts; scheduled ones (N4, N19) are sent directly. A unique dedupe key
 * plus an atomic DRAFT→QUEUED transition guarantee each e-mail is sent once.
 */
export class EmailService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly mailer: Mailer,
    private readonly files: FileService,
    private readonly audit: AuditLogger,
    private readonly logger: Logger,
  ) {}

  /** Returns the existing e-mail for the key, or creates a draft. */
  async getOrCreateDraft(input: DraftInput): Promise<EmailDraftDto> {
    const existing = await this.prisma.outboundEmail.findUnique({
      where: { dedupeKey: input.dedupeKey },
    });
    if (existing) {
      return toEmailDraftDto(existing);
    }
    try {
      const row = await this.prisma.outboundEmail.create({
        data: { ...input, appointmentId: input.appointmentId ?? null, status: EmailStatus.Draft },
      });
      return toEmailDraftDto(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const row = await this.prisma.outboundEmail.findUniqueOrThrow({
          where: { dedupeKey: input.dedupeKey },
        });
        return toEmailDraftDto(row);
      }
      throw error;
    }
  }

  async findByKey(dedupeKey: string): Promise<EmailDraftDto | null> {
    const row = await this.prisma.outboundEmail.findUnique({ where: { dedupeKey } });
    return row ? toEmailDraftDto(row) : null;
  }

  async get(id: string): Promise<EmailDraftDto> {
    const row = await this.prisma.outboundEmail.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundError();
    }
    return toEmailDraftDto(row);
  }

  /** The body can be edited before sending (spec §8 N1). */
  async updateDraft(
    id: string,
    input: { to: string[]; cc: string[]; subject: string; body: string },
  ): Promise<EmailDraftDto> {
    const result = await this.prisma.outboundEmail.updateMany({
      where: { id, status: { in: [EmailStatus.Draft, EmailStatus.Failed] } },
      data: input,
    });
    if (result.count === 0) {
      throw new InvalidStateError({ reason: 'already_sent' });
    }
    return this.get(id);
  }

  async sendDraft(actor: Actor, id: string): Promise<EmailDraftDto> {
    const claimed = await this.prisma.outboundEmail.updateMany({
      where: { id, status: { in: [EmailStatus.Draft, EmailStatus.Failed] } },
      data: { status: EmailStatus.Queued, error: null },
    });
    if (claimed.count === 0) {
      throw new InvalidStateError({ reason: 'already_sent' });
    }
    // The sender address may be shared, so the e-mail says who sent it (Sano 10/24 No.6).
    const draft = await this.prisma.outboundEmail.findUniqueOrThrow({ where: { id } });
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { name: true },
    });
    const stamped = stampOperator(draft, {
      name: user?.name ?? '',
      roles: Object.values(Role).filter((role) => actor.hasRole(role)),
    });
    const row = await this.prisma.outboundEmail.update({
      where: { id },
      data: { subject: stamped.subject, body: stamped.body },
    });
    const attachments = await this.loadAttachments(row.attachmentIds);
    try {
      await this.mailer.send({
        to: row.to,
        cc: row.cc,
        subject: row.subject,
        text: row.body,
        attachments,
      });
    } catch (error) {
      await this.prisma.outboundEmail.update({
        where: { id },
        data: { status: EmailStatus.Failed, error: String(error).slice(0, 1000) },
      });
      this.logger.error({ err: error, emailId: id }, 'e-mail sending failed');
      throw new InvalidStateError({ reason: 'send_failed' });
    }
    const sent = await this.prisma.outboundEmail.update({
      where: { id },
      data: { status: EmailStatus.Sent, sentAt: new Date() },
    });
    await this.audit.record({
      action: AuditAction.EmailSent,
      actorUserId: actor.id,
      targetType: 'email',
      targetId: id,
      metadata: {
        noticeCode: row.noticeCode,
        appointmentId: row.appointmentId,
        to: row.to,
        cc: row.cc,
      },
    });
    return toEmailDraftDto(sent);
  }

  /**
   * Sends immediately (scheduled and automatic notices).
   * Returns false when an e-mail with the same key was already sent.
   */
  async sendDirect(input: DirectEmailInput): Promise<boolean> {
    if (input.to.length === 0 && input.cc.length === 0) {
      return false;
    }
    // Sent right after someone's action (e.g. N6): name that person; scheduled: automatic.
    const operator = input.createdById ? await this.operatorOf(input.createdById) : null;
    const content = operator
      ? stampOperator({ subject: input.subject, body: input.body }, operator)
      : { subject: input.subject, body: stampAutomatic(input.body) };
    let row;
    try {
      row = await this.prisma.outboundEmail.create({
        data: {
          noticeCode: input.noticeCode,
          dedupeKey: input.dedupeKey,
          appointmentId: input.appointmentId ?? null,
          to: input.to.length > 0 ? input.to : input.cc,
          cc: input.to.length > 0 ? input.cc : [],
          subject: content.subject,
          body: content.body,
          attachmentIds: (input.attachments ?? []).flatMap((file) =>
            file.fileId ? [file.fileId] : [],
          ),
          status: EmailStatus.Queued,
          createdById: input.createdById ?? null,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return false;
      }
      throw error;
    }
    try {
      await this.mailer.send({
        to: row.to,
        cc: row.cc,
        subject: row.subject,
        text: row.body,
        attachments: input.attachments ?? [],
      });
      await this.prisma.outboundEmail.update({
        where: { id: row.id },
        data: { status: EmailStatus.Sent, sentAt: new Date() },
      });
      return true;
    } catch (error) {
      await this.prisma.outboundEmail.update({
        where: { id: row.id },
        data: { status: EmailStatus.Failed, error: String(error).slice(0, 1000) },
      });
      this.logger.error(
        { err: error, emailId: row.id, noticeCode: input.noticeCode },
        'e-mail sending failed',
      );
      return false;
    }
  }

  private async operatorOf(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, roles: { select: { role: true } } },
    });
    return user ? { name: user.name, roles: user.roles.map((row) => row.role) } : null;
  }

  private async loadAttachments(fileIds: string[]): Promise<MailAttachment[]> {
    const result: MailAttachment[] = [];
    for (const fileId of fileIds) {
      const { record, content } = await this.files.read(fileId);
      result.push({ filename: record.originalName, content, contentType: record.contentType });
    }
    return result;
  }
}
