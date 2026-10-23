import type { CalendarEvent } from '../events';
import { minutesWithin } from '../events';

/** Office hours drawn white on the grid and used for 空き (free time). */
export const WORK_START = 9 * 60;
export const WORK_END = 18 * 60;
/** Free stretches shorter than this are not worth offering. */
export const MIN_FREE_MINUTES = 60;

export interface PlacedEvent {
  event: CalendarEvent;
  start: number;
  end: number;
  /** Side-by-side lanes for overlapping events. */
  lane: number;
  lanes: number;
}

/**
 * Lays out one column's timed events like a desk calendar: events that overlap share the
 * width in lanes; a group of overlaps keeps the same lane count so the edges line up.
 */
export function placeEvents(events: CalendarEvent[], date: string): PlacedEvent[] {
  const items = events
    .filter((event) => !event.allDay)
    .map((event) => ({
      event,
      start: minutesWithin(event.startsAt, date, 'start'),
      end: Math.max(
        minutesWithin(event.startsAt, date, 'start') + 15,
        minutesWithin(event.endsAt, date, 'end'),
      ),
    }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const placed: PlacedEvent[] = [];
  let group: PlacedEvent[] = [];
  let groupEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...group.map((item) => item.lane + 1));
    for (const item of group) item.lanes = lanes;
    placed.push(...group);
    group = [];
  };
  for (const item of items) {
    if (item.start >= groupEnd && group.length > 0) flush();
    const laneEnds: number[] = [];
    for (const other of group)
      laneEnds[other.lane] = Math.max(laneEnds[other.lane] ?? 0, other.end);
    let lane = 0;
    while ((laneEnds[lane] ?? -1) > item.start) lane += 1;
    group.push({ ...item, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, item.end);
  }
  if (group.length > 0) flush();
  return placed;
}

/** Busy minutes of a day, merged (all-day time off fills the office hours). */
export function busyRanges(events: CalendarEvent[], date: string): [number, number][] {
  const ranges = events
    .map((event): [number, number] =>
      event.allDay
        ? event.kind === 'timeoff'
          ? [0, 24 * 60]
          : [0, 0]
        : [minutesWithin(event.startsAt, date, 'start'), minutesWithin(event.endsAt, date, 'end')],
    )
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

/** Free stretches inside office hours, at least MIN_FREE_MINUTES long. */
export function freeRanges(
  events: CalendarEvent[],
  date: string,
  { from = WORK_START, to = WORK_END, min = MIN_FREE_MINUTES } = {},
): [number, number][] {
  const free: [number, number][] = [];
  let cursor = from;
  for (const [start, end] of busyRanges(events, date)) {
    if (end <= cursor) continue;
    if (start >= to) break;
    if (start - cursor >= min) free.push([cursor, Math.min(start, to)]);
    cursor = Math.max(cursor, end);
  }
  if (to - cursor >= min) free.push([cursor, to]);
  return free;
}

export function freeMinutes(events: CalendarEvent[], date: string): number {
  return freeRanges(events, date, { min: 15 }).reduce((sum, [start, end]) => sum + end - start, 0);
}

export function hhmm(minutes: number): string {
  const clamped = Math.max(0, Math.min(minutes, 24 * 60));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

export function toMinutes(time: string): number {
  const [hours = 0, mins = 0] = time.split(':').map(Number);
  return hours * 60 + mins;
}

/** 4時間 / 1.5時間 / 45分 */
export function hoursLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}分`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}時間`;
}
