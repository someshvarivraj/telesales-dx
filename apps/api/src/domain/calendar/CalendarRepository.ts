import type { BusinessCalendar } from './BusinessCalendar.js';

export interface CalendarRepository {
  /** Calendar covering [from, to] plus a margin so previous/next business day lookups work. */
  load(from: string, to: string): Promise<BusinessCalendar>;
}
