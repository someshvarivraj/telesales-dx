import {
  addDays,
  AppointmentSource,
  AppointmentStatus,
  ChangeRequestStatus,
  formatSlashDate,
  fromJst,
  jstDate,
  jstMinutesOfDay,
  MeetingFormat,
  NoticeCode,
  OptionCategory,
  PlanStatus,
} from '@telesales/shared';
import type { Logger } from 'pino';
import { AuditAction } from '../../domain/audit/AuditLogger.js';
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
import type { SettingsService } from '../settings/SettingsService.js';
import type { AllocationService } from '../telema/AllocationService.js';

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
    private readonly settings: SettingsService,
    private readonly allocations: AllocationService,
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
      await this.runIfDue(NoticeCode.MeetingUrlMissing, () => this.remindMeetingUrls());
      await this.runIfDue(NoticeCode.DayBeforeMissing, () => this.remindDayBeforeChecks());
      await this.runIfDue(NoticeCode.TentativeExpired, () => this.remindExpiredTentatives());
      await this.remindUntakenChangeRequests();
      await this.runMorningAllocation();
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

  /**
   * N3 — online appointments without a meeting URL, 3 days and 1 day before (moved to the
   * previous business day when that day is a holiday). Stops once a URL is entered.
   */
  async remindMeetingUrls(): Promise<void> {
    const setting = await this.prisma.noticeSetting.findUnique({
      where: { code: NoticeCode.MeetingUrlMissing },
    });
    const daysBefore = setting?.daysBefore.length ? setting.daysBefore : [3, 1];
    const today = jstDate(this.clock.now());
    const horizon = addDays(today, Math.max(...daysBefore) + 14);
    const calendar = await this.calendar.load(addDays(today, -1), horizon);
    const reminderDay = (date: string, days: number) => {
      let day = addDays(date, -days);
      while (!calendar.isBusinessDay(day)) {
        day = addDays(day, -1);
      }
      return day;
    };
    const due = new Map<string, number>();
    for (let date = addDays(today, 1); date <= horizon; date = addDays(date, 1)) {
      for (const days of daysBefore) {
        if (reminderDay(date, days) === today && !due.has(date)) {
          due.set(date, days);
        }
      }
    }
    if (due.size === 0) {
      return;
    }
    const dates = [...due.keys()].sort();
    const first = dates[0] ?? today;
    const last = dates[dates.length - 1] ?? today;
    const rows = await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.Scheduled,
        format: MeetingFormat.Online,
        meetingUrl: null,
        startsAt: { gte: fromJst(first), lt: fromJst(addDays(last, 1)) },
      },
      select: { id: true, startsAt: true, salesRepId: true, company: { select: { name: true } } },
    });
    for (const row of rows) {
      const date = jstDate(row.startsAt);
      const days = due.get(date);
      if (days === undefined) {
        continue;
      }
      await this.notifications.notify({
        code: NoticeCode.MeetingUrlMissing,
        context: { ASSIGNED_REP: [row.salesRepId] },
        title: `会議URLが未登録です：${row.company.name}（${formatSlashDate(date)}）`,
        linkPath: `/appointments/${row.id}`,
        dedupeKey: `N3:${row.id}:${days}`,
      });
    }
  }

  /** N12 — at 15:00, day-before checks still not entered. */
  async remindDayBeforeChecks(): Promise<void> {
    const today = jstDate(this.clock.now());
    const calendar = await this.calendar.load(today, addDays(today, 14));
    const { first, last } = calendar.checkWindow(today);
    const missing = await this.prisma.appointment.count({
      where: {
        status: AppointmentStatus.Scheduled,
        source: { not: AppointmentSource.SalesBooked },
        dayBeforeResult: null,
        startsAt: { gte: fromJst(first), lt: fromJst(addDays(last, 1)) },
      },
    });
    if (missing === 0) {
      return;
    }
    await this.notifications.notify({
      code: NoticeCode.DayBeforeMissing,
      title: `前日確認が未入力のアポが ${missing} 件あります`,
      linkPath: '/appointments/day-before',
      dedupeKey: `N12:${today}`,
    });
  }

  /** N15 — at 09:00, tentative plans whose candidate dates have all passed. */
  async remindExpiredTentatives(): Promise<void> {
    const now = this.clock.now();
    const rows = await this.prisma.schedulePlan.findMany({
      where: { status: PlanStatus.Tentative, deletedAt: null, appointmentId: null },
      select: { id: true, ownerId: true, title: true, endsAt: true, candidateGroupId: true },
    });
    const groups = new Map<string, typeof rows>();
    rows.forEach((row) => {
      const key = row.candidateGroupId ?? row.id;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    });
    for (const [key, plans] of groups) {
      const [plan] = plans;
      if (!plan || plans.some((candidate) => candidate.endsAt > now)) {
        continue;
      }
      await this.notifications.notify({
        code: NoticeCode.TentativeExpired,
        context: { PLAN_OWNER: [plan.ownerId] },
        title: `仮予定の候補日が過ぎました：${plan.title}`,
        body: '確定するか、消してください。',
        linkPath: `/schedule?date=${jstDate(plan.endsAt)}`,
        dedupeKey: `N15:${key}`,
      });
    }
  }

  /**
   * N13 — a change request nobody has taken for the configured time (off by default;
   * the spec lists it as future). Checked every minute while it is switched on.
   */
  async remindUntakenChangeRequests(): Promise<void> {
    const setting = await this.prisma.noticeSetting.findUnique({
      where: { code: NoticeCode.ChangeRequestUntaken },
    });
    if (!setting?.isEnabled) {
      return;
    }
    const { changeRequestReminderMinutes } = await this.settings.get();
    const before = new Date(this.clock.now().getTime() - changeRequestReminderMinutes * 60_000);
    const rows = await this.prisma.changeRequest.findMany({
      where: { status: ChangeRequestStatus.Requested, createdAt: { lte: before } },
      select: {
        id: true,
        appointmentId: true,
        appointment: { select: { company: { select: { name: true } } } },
      },
    });
    for (const row of rows) {
      await this.notifications.notify({
        code: NoticeCode.ChangeRequestUntaken,
        title: `変更依頼が未対応です：${row.appointment.company.name}`,
        linkPath: '/appointments/change-requests',
        dedupeKey: `N13:${row.id}`,
      });
    }
  }

  /** The morning allocation run: a draft for today, once, on business days. */
  async runMorningAllocation(): Promise<void> {
    const now = this.clock.now();
    const today = jstDate(now);
    const { allocationRunTime } = await this.settings.get();
    const due = minutesOf(allocationRunTime);
    if (due === null || jstMinutesOfDay(now) < due) {
      return;
    }
    const calendar = await this.calendar.load(today, today);
    if (!calendar.isBusinessDay(today) || (await this.allocations.hasAllocation(today))) {
      return;
    }
    const ran = await this.prisma.auditLog.findFirst({
      where: { action: AuditAction.AllocationCalculated, targetId: today },
      select: { id: true },
    });
    if (ran) {
      return;
    }
    try {
      const result = await this.allocations.calculate(null, today);
      this.logger.info(result, 'morning allocation calculated');
    } catch (error) {
      // Nobody working yet, etc. The lead can run it by hand; do not retry every minute.
      await this.prisma.auditLog.create({
        data: {
          action: AuditAction.AllocationCalculated,
          targetType: 'allocation',
          targetId: today,
          metadata: { skipped: error instanceof Error ? error.message || error.name : 'error' },
        },
      });
    }
  }
}
