import {
  addDays,
  AppointmentStatus,
  fromJst,
  jstDate,
  jstMinutesOfDay,
  NoticeCode,
  OptionCategory,
} from '@telesales/shared';
import type { Logger } from 'pino';
import type { CalendarRepository } from '../../domain/calendar/CalendarRepository.js';
import type { Clock } from '../../domain/Clock.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { appointmentDetailInclude } from '../appointments/appointmentMapping.js';
import { mailAppointmentOf } from '../appointments/AppointmentMailService.js';
import {
  dailyListMail,
  tomorrowAppointmentsMail,
} from '../appointments/AppointmentMailTemplates.js';
import type { AppointmentReportService } from '../appointments/AppointmentReportService.js';
import type { FileService } from '../files/FileService.js';
import type { EmailService } from '../notifications/EmailService.js';
import type { NotificationService } from '../notifications/NotificationService.js';
import type { RecipientResolver } from '../notifications/RecipientResolver.js';
import type { OptionService } from '../options/OptionService.js';

const TICK_MS = 60_000;
const SYSTEM_USER_FOR_FILES = null;

function minutesOf(time: string | null): number | null {
  const match = time ? /^(\d{2}):(\d{2})$/.exec(time) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * Scheduled notices (spec §6 定時処理). Runs every minute; each job is due once its JST
 * time has passed on a business day, and dedupe keys make every run idempotent, so a
 * restart or a second instance never sends twice. Times are admin settings, not code.
 */
export class ScheduledJobs {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly calendar: CalendarRepository,
    private readonly emails: EmailService,
    private readonly recipients: RecipientResolver,
    private readonly notifications: NotificationService,
    private readonly reports: AppointmentReportService,
    private readonly files: FileService,
    private readonly options: OptionService,
    private readonly clock: Clock,
    private readonly appBaseUrl: string,
    private readonly logger: Logger,
  ) {}

  start(): void {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
    void this.tick();
  }

  stop(): void {
    clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.prisma.slotLock.deleteMany({ where: { expiresAt: { lt: this.clock.now() } } });
      await this.runIfDue(NoticeCode.TomorrowAppointments, () => this.sendTomorrowAppointments());
      await this.runIfDue(NoticeCode.DailyAppointmentList, () => this.sendDailyList());
    } catch (error) {
      this.logger.error({ err: error }, 'scheduled job failed');
    } finally {
      this.running = false;
    }
  }

  private async runIfDue(code: NoticeCode, job: () => Promise<void>): Promise<void> {
    const setting = await this.prisma.noticeSetting.findUnique({ where: { code } });
    const due = minutesOf(setting?.sendTime ?? null);
    if (!setting?.isEnabled || due === null) {
      return;
    }
    const now = this.clock.now();
    const today = jstDate(now);
    const calendar = await this.calendar.load(today, today);
    if (!calendar.isBusinessDay(today) || jstMinutesOfDay(now) < due) {
      return;
    }
    await job();
  }

  /** N4 — at 12:00 on the previous business day, each rep gets their next-day appointments. */
  async sendTomorrowAppointments(): Promise<void> {
    const today = jstDate(this.clock.now());
    const calendar = await this.calendar.load(today, addDays(today, 14));
    const { first, last, dates } = calendar.checkWindow(today);
    const rows = await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.Scheduled,
        startsAt: { gte: fromJst(first), lt: fromJst(addDays(last, 1)) },
      },
      include: appointmentDetailInclude,
      orderBy: { startsAt: 'asc' },
    });
    const labels = await this.options.labels(OptionCategory.CustomerType);
    const byRep = new Map<string, typeof rows>();
    rows.forEach((row) => byRep.set(row.salesRepId, [...(byRep.get(row.salesRepId) ?? []), row]));

    for (const [repId, appointments] of byRep) {
      const resolved = await this.recipients.resolve(NoticeCode.TomorrowAppointments, {
        ASSIGNED_REP: [repId],
      });
      const repName = appointments[0]?.salesRep.name ?? '';
      const content = tomorrowAppointmentsMail(
        repName,
        dates,
        appointments.map((row) => mailAppointmentOf(row, labels)),
        this.appBaseUrl,
      );
      const sent = await this.emails.sendDirect({
        noticeCode: NoticeCode.TomorrowAppointments,
        dedupeKey: `N4:${today}:${repId}`,
        to: resolved.to,
        cc: resolved.cc,
        subject: content.subject,
        body: content.body,
      });
      if (sent) {
        this.logger.info({ repId, count: appointments.length }, 'N4 sent');
        await this.notifications.notifyUsers([repId], {
          code: NoticeCode.TomorrowAppointments,
          title: `${content.subject}：${appointments.length}件`,
          linkPath: `/schedule?date=${dates[0]}`,
        });
      }
    }
  }

  /** N19 — the day's booked appointments, with the report Excel attached. */
  async sendDailyList(): Promise<void> {
    const today = jstDate(this.clock.now());
    const dedupeKey = `N19:${today}`;
    if (await this.emails.findByKey(dedupeKey)) {
      return;
    }
    const resolved = await this.recipients.resolve(NoticeCode.DailyAppointmentList);
    if (resolved.to.length === 0 && resolved.cc.length === 0) {
      return;
    }
    const report = await this.reports.build(today, today);
    const stored = await this.files.storeGenerated(
      {
        originalname: report.fileName,
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: report.content.length,
        buffer: report.content,
      },
      SYSTEM_USER_FOR_FILES,
    );
    const content = dailyListMail(today, report.count);
    await this.emails.sendDirect({
      noticeCode: NoticeCode.DailyAppointmentList,
      dedupeKey,
      to: resolved.to,
      cc: resolved.cc,
      subject: content.subject,
      body: content.body,
      attachments: [
        {
          filename: report.fileName,
          content: report.content,
          contentType: stored.contentType,
          fileId: stored.id,
        },
      ],
    });
    this.logger.info({ count: report.count }, 'N19 sent');
  }
}
