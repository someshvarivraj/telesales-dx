import {
  addDays,
  dayOfWeek,
  DEFAULT_APPOINTMENT_MINUTES,
  fromJst,
  jstDate,
  jstTime,
  SLOT_MINUTES,
  weekdayJa,
} from '@telesales/shared';

/** 2026/10/15（木） */
export function formatDate(date: string): string {
  return `${date.replaceAll('-', '/')}（${weekdayJa(date)}）`;
}

/** 10/15（木） */
export function formatShortDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${Number(month)}/${Number(day)}（${weekdayJa(date)}）`;
}

/** 2026/10/15（木）10:00 */
export function formatDateTime(iso: string): string {
  const instant = new Date(iso);
  return `${formatDate(jstDate(instant))} ${jstTime(instant)}`;
}

/** 10/15（木）10:00〜11:00 */
export function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const startDate = jstDate(start);
  const endDate = jstDate(new Date(end.getTime() - 1));
  const head = `${formatShortDate(startDate)} ${jstTime(start)}〜`;
  return startDate === endDate
    ? `${head}${jstTime(end)}`
    : `${head}${formatShortDate(endDate)} ${jstTime(end)}`;
}

export function formatTime(iso: string): string {
  return jstTime(new Date(iso));
}

export function todayJst(): string {
  return jstDate(new Date());
}

/** 15-minute steps for time pickers (spec §7). */
export function timeOptions(from = 7, to = 21): string[] {
  const result: string[] = [];
  for (let minutes = from * 60; minutes <= to * 60; minutes += SLOT_MINUTES) {
    result.push(
      `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
    );
  }
  return result;
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [hours = 0, mins = 0] = time.split(':').map(Number);
  const total = Math.min(hours * 60 + mins + minutes, 24 * 60 - SLOT_MINUTES);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function defaultEndTime(start: string): string {
  return addMinutesToTime(start, DEFAULT_APPOINTMENT_MINUTES);
}

/** ISO instant from a JST date and time. */
export function toInstant(date: string, time: string): string {
  return fromJst(date, time).toISOString();
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: string): string {
  return addDays(date, -((dayOfWeek(date) + 6) % 7));
}

export function monthRange(date: string): { from: string; to: string } {
  const [year, month] = date.split('-').map(Number) as [number, number];
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const next =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return { from, to: addDays(next, -1) };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatPercent(rate: number | null): string {
  return rate === null ? '―' : `${(rate * 100).toFixed(1)}%`;
}
