import { addDays, isWeekend } from '@telesales/shared';

export interface Holiday {
  date: string;
  name: string;
}

/**
 * Business day = not a weekend, public holiday or company holiday (spec §7).
 * Built from the calendar rows of the period in question; pure and easy to test.
 */
export class BusinessCalendar {
  private readonly holidays: Map<string, string>;

  constructor(holidays: readonly Holiday[]) {
    this.holidays = new Map(holidays.map((holiday) => [holiday.date, holiday.name]));
  }

  holidayName(date: string): string | null {
    return this.holidays.get(date) ?? null;
  }

  isBusinessDay(date: string): boolean {
    return !isWeekend(date) && !this.holidays.has(date);
  }

  /** The business day before `date` (Monday → Friday). */
  previousBusinessDay(date: string): string {
    let day = addDays(date, -1);
    while (!this.isBusinessDay(day)) {
      day = addDays(day, -1);
    }
    return day;
  }

  /** The business day after `date` (Friday → Monday). */
  nextBusinessDay(date: string): string {
    let day = addDays(date, 1);
    while (!this.isBusinessDay(day)) {
      day = addDays(day, 1);
    }
    return day;
  }

  /** `count` business days before `date`. */
  businessDaysBefore(date: string, count: number): string {
    let day = date;
    for (let i = 0; i < count; i += 1) {
      day = this.previousBusinessDay(day);
    }
    return day;
  }

  /**
   * All dates whose previous business day is `today` — e.g. on Friday this is
   * Saturday, Sunday and Monday. Used for "tomorrow's appointments" (N4) and day-before checks.
   */
  datesCheckedOn(today: string): string[] {
    return this.checkWindow(today).dates;
  }

  /** The same dates as a range: [first, last] (last is the next business day). */
  checkWindow(today: string): { first: string; last: string; dates: string[] } {
    const last = this.nextBusinessDay(today);
    const first = addDays(today, 1);
    const dates: string[] = [];
    for (let day = first; day <= last; day = addDays(day, 1)) {
      dates.push(day);
    }
    return { first, last, dates };
  }
}
