import { type CalendarDayAdminDto, HolidayKind } from '@telesales/shared';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import {
  FileUnreadableError,
  InvalidStateError,
  NotFoundError,
} from '../../http/errors/AppError.js';
import { dateOnly, toDbDate } from '../../http/mappers.js';
import { parseHolidayCsv } from './HolidayCsvParser.js';

export type HolidaySource = () => Promise<Buffer>;

export class CalendarService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditLogger,
    private readonly fetchHolidayCsv: HolidaySource,
  ) {}

  async listRange(from: string, to: string): Promise<CalendarDayAdminDto[]> {
    const rows = await this.prisma.calendarDay.findMany({
      where: { date: { gte: toDbDate(from), lte: toDbDate(to) } },
      orderBy: { date: 'asc' },
    });
    return rows.map((row) => ({ date: dateOnly(row.date), name: row.name, kind: row.kind }));
  }

  async addCompanyHoliday(actor: Actor, date: string, name: string): Promise<CalendarDayAdminDto> {
    const existing = await this.prisma.calendarDay.findUnique({ where: { date: toDbDate(date) } });
    if (existing) {
      throw new InvalidStateError({ reason: 'already_holiday', name: existing.name });
    }
    const row = await this.prisma.calendarDay.create({
      data: { date: toDbDate(date), name, kind: HolidayKind.CompanyHoliday },
    });
    await this.audit.record({
      action: AuditAction.SettingsChanged,
      actorUserId: actor.id,
      targetType: 'calendar_day',
      targetId: date,
      after: { name, kind: row.kind },
    });
    return { date, name: row.name, kind: row.kind };
  }

  /** Only company holidays can be removed by hand; public holidays come from the import. */
  async removeCompanyHoliday(actor: Actor, date: string): Promise<void> {
    const row = await this.prisma.calendarDay.findUnique({ where: { date: toDbDate(date) } });
    if (!row || row.kind !== HolidayKind.CompanyHoliday) {
      throw new NotFoundError();
    }
    await this.prisma.calendarDay.delete({ where: { date: row.date } });
    await this.audit.record({
      action: AuditAction.SettingsChanged,
      actorUserId: actor.id,
      targetType: 'calendar_day',
      targetId: date,
      before: { name: row.name, kind: row.kind },
    });
  }

  /**
   * Loads Japanese public holidays (spec §9-4). Uses an uploaded CSV when given,
   * otherwise downloads the Cabinet Office CSV. Existing company holidays are kept.
   */
  async importPublicHolidays(
    actor: Actor,
    year: number,
    uploaded?: Buffer,
  ): Promise<{ imported: number }> {
    let content: Buffer;
    try {
      content = uploaded ?? (await this.fetchHolidayCsv());
    } catch {
      throw new FileUnreadableError({ reason: 'download_failed' });
    }
    const holidays = parseHolidayCsv(content).filter((h) => h.date.startsWith(`${year}-`));
    if (holidays.length === 0) {
      throw new FileUnreadableError({ reason: 'no_holidays_for_year', year });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.calendarDay.deleteMany({
        where: {
          kind: HolidayKind.PublicHoliday,
          date: { gte: toDbDate(`${year}-01-01`), lte: toDbDate(`${year}-12-31`) },
        },
      });
      for (const holiday of holidays) {
        await tx.calendarDay.upsert({
          where: { date: toDbDate(holiday.date) },
          // A company holiday on the same date stays as entered.
          update: {},
          create: {
            date: toDbDate(holiday.date),
            name: holiday.name,
            kind: HolidayKind.PublicHoliday,
          },
        });
      }
    });

    await this.audit.record({
      action: AuditAction.SettingsChanged,
      actorUserId: actor.id,
      targetType: 'calendar_year',
      targetId: String(year),
      after: { importedPublicHolidays: holidays.length },
    });
    return { imported: holidays.length };
  }
}
