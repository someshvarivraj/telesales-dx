import {
  AppointmentStatus,
  type EmailDraftDto,
  EmailStatus,
  jstDate,
  NoticeCode,
  OptionCategory,
  type UpdateEmailDraftRequest,
} from '@telesales/shared';
import type { AccessPolicy, Actor } from '../../domain/access/AccessPolicy.js';
import type { Clock } from '../../domain/Clock.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { ForbiddenError, InvalidStateError, NotFoundError } from '../../http/errors/AppError.js';
import type { EmailService } from '../notifications/EmailService.js';
import type { NotificationService } from '../notifications/NotificationService.js';
import type { RecipientResolver } from '../notifications/RecipientResolver.js';
import type { OptionService } from '../options/OptionService.js';
import type { AppointmentDetailRow } from './appointmentMapping.js';
import {
  bookingMail,
  cancellationMail,
  dayBeforeResultMail,
  type MailAppointment,
} from './AppointmentMailTemplates.js';
import { type AppointmentQueryService, factsOf } from './AppointmentQueryService.js';

export type AppointmentMailKind = 'booking' | 'cancellation' | 'dayBefore';

const NOTICE_OF: Record<AppointmentMailKind, (typeof NoticeCode)[keyof typeof NoticeCode]> = {
  booking: NoticeCode.Booking,
  cancellation: NoticeCode.Cancelled,
  dayBefore: NoticeCode.DayBeforeResult,
};

/** Builds the template input from an appointment row. */
export function mailAppointmentOf(
  row: AppointmentDetailRow,
  customerTypeLabels: Map<string, string>,
): MailAppointment {
  return {
    id: row.id,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    format: row.format,
    customerTypeLabel: row.customerType
      ? (customerTypeLabels.get(row.customerType) ?? row.customerType)
      : null,
    listName: row.listName,
    bookedAt: row.bookedAt,
    bookerName: row.bookedBy.name,
    repName: row.salesRep.name,
    contactName: row.contactName,
    contactDepartment: row.contactDepartment,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    handoverNotes: row.handoverNotes,
    visitAddress: row.visitAddress,
    meetingUrl: row.meetingUrl,
    company: {
      name: row.company.name,
      clientNo: row.company.clientNo,
      nearestStation: row.company.nearestStation,
      address: row.company.address,
      phone: row.company.phone,
      department: row.company.department,
    },
  };
}

/**
 * "Open the preview, check, then send" e-mails for one appointment: N1 booking,
 * N8 cancellation and N14 day-before result. Each is one dedupe key, so it is sent once;
 * a correction is sent as an explicit 【再送】.
 */
export class AppointmentMailService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly policy: AccessPolicy,
    private readonly queries: AppointmentQueryService,
    private readonly emails: EmailService,
    private readonly recipients: RecipientResolver,
    private readonly notifications: NotificationService,
    private readonly options: OptionService,
    private readonly clock: Clock,
  ) {}

  async draft(actor: Actor, id: string, kind: AppointmentMailKind): Promise<EmailDraftDto> {
    const row = await this.queries.loadRow(id);
    this.assertAllowed(actor, row, kind);
    const key = await this.currentKey(row, kind);
    const existing = await this.emails.findByKey(key);
    if (existing) {
      return existing;
    }
    return this.createDraft(actor, row, kind, key, false);
  }

  /** A new 【再送】 draft after the booking e-mail was sent (e.g. corrected contact details). */
  async resendBooking(actor: Actor, id: string): Promise<EmailDraftDto> {
    const row = await this.queries.loadRow(id);
    this.assertAllowed(actor, row, 'booking');
    const sent = await this.prisma.outboundEmail.count({
      where: { appointmentId: id, noticeCode: NoticeCode.Booking, status: EmailStatus.Sent },
    });
    if (sent === 0) {
      throw new InvalidStateError({ reason: 'not_sent_yet' });
    }
    const openDraft = await this.prisma.outboundEmail.findFirst({
      where: {
        appointmentId: id,
        noticeCode: NoticeCode.Booking,
        status: { in: [EmailStatus.Draft, EmailStatus.Failed] },
      },
    });
    if (openDraft) {
      return this.emails.get(openDraft.id);
    }
    return this.createDraft(actor, row, 'booking', `N1:${id}:resend:${sent}`, true);
  }

  /** Rebuilds an unsent draft from the current appointment data. */
  async regenerate(actor: Actor, id: string, emailId: string): Promise<EmailDraftDto> {
    const { row, email } = await this.loadEmail(actor, id, emailId);
    const kind = this.kindOf(email.noticeCode);
    const content = await this.content(row, kind, email.dedupeKey?.includes(':resend:') ?? false);
    const resolved = await this.resolve(row, kind);
    return this.emails.updateDraft(emailId, { to: resolved.to, cc: resolved.cc, ...content });
  }

  async update(
    actor: Actor,
    id: string,
    emailId: string,
    input: UpdateEmailDraftRequest,
  ): Promise<EmailDraftDto> {
    await this.loadEmail(actor, id, emailId);
    return this.emails.updateDraft(emailId, {
      to: input.to,
      cc: input.cc ?? [],
      subject: input.subject,
      body: input.body,
    });
  }

  async send(actor: Actor, id: string, emailId: string): Promise<EmailDraftDto> {
    const { row, email } = await this.loadEmail(actor, id, emailId);
    const sent = await this.emails.sendDraft(actor, emailId);
    if (
      email.noticeCode === NoticeCode.Cancelled ||
      email.noticeCode === NoticeCode.DayBeforeResult
    ) {
      await this.notifications.notifyUsers([row.salesRepId], {
        code: email.noticeCode,
        title: `${email.noticeCode === NoticeCode.Cancelled ? 'アポ取り消し' : '前日確認の結果'}：${row.company.name}`,
        linkPath: `/appointments/${id}`,
        actorId: actor.id,
      });
    }
    return sent;
  }

  private async createDraft(
    actor: Actor,
    row: AppointmentDetailRow,
    kind: AppointmentMailKind,
    key: string,
    resend: boolean,
  ) {
    const content = await this.content(row, kind, resend);
    const resolved = await this.resolve(row, kind);
    return this.emails.getOrCreateDraft({
      noticeCode: NOTICE_OF[kind],
      dedupeKey: key,
      appointmentId: row.id,
      to: resolved.to,
      cc: resolved.cc,
      subject: content.subject,
      body: content.body,
      createdById: actor.id,
    });
  }

  private async content(row: AppointmentDetailRow, kind: AppointmentMailKind, resend: boolean) {
    const labels = await this.options.labels(OptionCategory.CustomerType);
    const appointment = mailAppointmentOf(row, labels);
    switch (kind) {
      case 'booking':
        return bookingMail(appointment, { resend });
      case 'cancellation': {
        const cancelChange = await this.prisma.appointmentChange.findFirst({
          where: { appointmentId: row.id },
          orderBy: { createdAt: 'desc' },
        });
        const note = (cancelChange?.after as { note?: string | null } | null)?.note ?? null;
        return cancellationMail(appointment, note);
      }
      case 'dayBefore':
        if (!row.dayBeforeResult || !row.dayBeforeCheckedBy) {
          throw new InvalidStateError({ reason: 'not_checked' });
        }
        return dayBeforeResultMail(appointment, row.dayBeforeResult, row.dayBeforeCheckedBy.name);
    }
  }

  private resolve(row: AppointmentDetailRow, kind: AppointmentMailKind) {
    return this.recipients.resolve(NOTICE_OF[kind], {
      ASSIGNED_REP: [row.salesRepId],
      BOOKER: [row.bookedById],
    });
  }

  private async currentKey(row: AppointmentDetailRow, kind: AppointmentMailKind): Promise<string> {
    switch (kind) {
      case 'booking':
        return `N1:${row.id}`;
      case 'cancellation':
        return `N8:${row.id}`;
      case 'dayBefore':
        return `N14:${row.id}:${row.dayBeforeCheckedAt ? row.dayBeforeCheckedAt.toISOString() : jstDate(this.clock.now())}`;
    }
  }

  private assertAllowed(actor: Actor, row: AppointmentDetailRow, kind: AppointmentMailKind): void {
    const abilities = this.policy.abilitiesFor(actor, factsOf(row));
    const allowed =
      kind === 'booking'
        ? abilities.sendBookingMail
        : kind === 'cancellation'
          ? row.status === AppointmentStatus.Cancelled && this.policy.canManage(actor, row.source)
          : abilities.dayBeforeCheck;
    if (!allowed) {
      throw new ForbiddenError();
    }
  }

  private kindOf(code: string): AppointmentMailKind {
    if (code === NoticeCode.Cancelled) return 'cancellation';
    if (code === NoticeCode.DayBeforeResult) return 'dayBefore';
    return 'booking';
  }

  private async loadEmail(actor: Actor, id: string, emailId: string) {
    const email = await this.prisma.outboundEmail.findUnique({ where: { id: emailId } });
    if (!email || email.appointmentId !== id) {
      throw new NotFoundError();
    }
    const row = await this.queries.loadRow(id);
    this.assertAllowed(actor, row, this.kindOf(email.noticeCode));
    return { row, email };
  }
}
