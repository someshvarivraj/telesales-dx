import { addDays } from '@telesales/shared';
import { BusinessCalendar } from '../../domain/calendar/BusinessCalendar.js';
import type { CalendarRepository } from '../../domain/calendar/CalendarRepository.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { dateOnly, toDbDate } from '../../http/mappers.js';

/** Long holiday runs (e.g. New Year) need a margin for previous/next business day lookups. */
const MARGIN_DAYS = 21;

export class PrismaCalendarRepository implements CalendarRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async load(from: string, to: string): Promise<BusinessCalendar> {
    const rows = await this.prisma.calendarDay.findMany({
      where: {
        date: {
          gte: toDbDate(addDays(from, -MARGIN_DAYS)),
          lte: toDbDate(addDays(to, MARGIN_DAYS)),
        },
      },
      select: { date: true, name: true },
    });
    return new BusinessCalendar(rows.map((row) => ({ date: dateOnly(row.date), name: row.name })));
  }
}
