/**
 * Japan time helpers (spec §11: all times are JST). Japan has no daylight saving,
 * so a fixed +09:00 offset is exact. Dates are exchanged as 'YYYY-MM-DD' strings and
 * instants as ISO strings, so neither side depends on the device time zone.
 */
const JST_OFFSET_MS = 9 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** Times are entered in 15-minute steps (spec §7). */
export const SLOT_MINUTES = 15;
/** Default appointment length (spec §7). */
export const DEFAULT_APPOINTMENT_MINUTES = 60;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function shift(instant: Date): Date {
  return new Date(instant.getTime() + JST_OFFSET_MS);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function isDateString(value: string): boolean {
  return DATE_PATTERN.test(value);
}

export function isTimeString(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** 'YYYY-MM-DD' of the instant in JST. */
export function jstDate(instant: Date): string {
  const d = shift(instant);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 'HH:mm' of the instant in JST. */
export function jstTime(instant: Date): string {
  const d = shift(instant);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Minutes since JST midnight. */
export function jstMinutesOfDay(instant: Date): number {
  const d = shift(instant);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** The instant for a JST calendar date and wall-clock time. */
export function fromJst(date: string, time = '00:00'): Date {
  const dateMatch = DATE_PATTERN.exec(date);
  const timeMatch = TIME_PATTERN.exec(time);
  if (!dateMatch || !timeMatch) {
    throw new RangeError(`Invalid JST date/time: ${date} ${time}`);
  }
  const utc = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  return new Date(utc - JST_OFFSET_MS);
}

/** Start of the JST day containing the instant. */
export function startOfJstDay(instant: Date): Date {
  return fromJst(jstDate(instant));
}

export function addDays(date: string, days: number): string {
  const base = fromJst(date);
  return jstDate(new Date(base.getTime() + days * DAY_MS));
}

/** "2026-10-30" + 6 months → "2027-04-30" (end of a shorter month: its last day). */
export function addMonthsToDate(date: string, months: number): string {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60_000);
}

/** 0 = Sunday … 6 = Saturday, for a 'YYYY-MM-DD' date. */
export function dayOfWeek(date: string): number {
  return shift(fromJst(date)).getUTCDay();
}

export function isWeekend(date: string): boolean {
  const day = dayOfWeek(date);
  return day === 0 || day === 6;
}

/** Inclusive list of dates from `from` to `to`. */
export function datesBetween(from: string, to: string): string[] {
  const result: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    result.push(date);
  }
  return result;
}

/** True when the instant falls on a 15-minute boundary. */
export function isOnSlotBoundary(instant: Date): boolean {
  return instant.getTime() % (SLOT_MINUTES * 60_000) === 0;
}

export function rangesOverlap(
  a: { startsAt: Date; endsAt: Date },
  b: { startsAt: Date; endsAt: Date },
): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'] as const;

export function weekdayJa(date: string): string {
  return WEEKDAY_JA[dayOfWeek(date)] ?? '';
}

/** 'YYYY/MM/DD' — the format used in today's e-mails and reports. */
export function formatSlashDate(date: string): string {
  return date.replaceAll('-', '/');
}

/** 'YYYY/MM/DD HH:mm' in JST. */
export function formatJstDateTime(instant: Date): string {
  return `${formatSlashDate(jstDate(instant))} ${jstTime(instant)}`;
}
