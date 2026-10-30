import { jstMinutesOfDay, SLOT_MINUTES } from '@telesales/shared';
import { Building2, Lock, Video } from 'lucide-react';
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui/cn';
import { formatTime, todayJst } from '@/lib/format';
import { type CalendarEvent, EVENT_STYLE } from '../events';
import type { PeekBinder } from './EventPeek';
import {
  freeRanges,
  hhmm,
  hoursLabel,
  placeEvents,
  toMinutes,
  visibleSpan,
  WORK_END,
  WORK_START,
} from './layout';
import { ScrollPager } from './ScrollPager';

export interface GridColumn {
  key: string;
  date: string;
  personId: string;
  header: ReactNode;
  /** Weekend, holiday or company day off: tinted. */
  off: boolean;
  events: CalendarEvent[];
}

interface TimeGridProps {
  columns: GridColumn[];
  pxPerMin?: number;
  dayStart?: number;
  dayEnd?: number;
  onEvent: (event: CalendarEvent) => void;
  peek?: PeekBinder;
  /** Drag (or click) on empty time: the range is snapped to 15 minutes. */
  onRange?: (column: GridColumn, start: string, end: string) => void;
  /** Highlight the slot being booked. */
  selection?: { personId: string; date: string; start: string; end: string } | null;
  /** Show free stretches in office hours. */
  showFree?: boolean;
  /** Travel time kept free around appointments (minutes), drawn hatched. */
  bufferMinutes?: number;
  /** Max height of the scrolling area. */
  maxHeight?: string;
  minColumnWidth?: number;
  /** Label for the empty-time area of one column (screen readers). */
  columnLabel?: (column: GridColumn) => string;
}

function snap(minutes: number): number {
  return Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES;
}

/** Re-renders every minute so the now-line moves. */
export function useNow(): { date: string; minutes: number } {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return { date: todayJst(), minutes: jstMinutesOfDay(now) };
}

/**
 * Time grid with one column per person (day view) or per day (one person's week): events
 * side by side when they overlap, a red now-line, office hours white and the rest tinted,
 * travel buffers hatched, free stretches marked, and drag on empty time to make a plan.
 */
export function TimeGrid({
  columns,
  pxPerMin = 1,
  dayStart: fixedStart,
  dayEnd: fixedEnd,
  onEvent,
  peek,
  onRange,
  selection,
  showFree = false,
  bufferMinutes = 0,
  maxHeight = 'calc(100dvh - 15rem)',
  minColumnWidth = 176,
  columnLabel,
}: TimeGridProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const now = useNow();
  // 9:00–18:00 unless something on screen is earlier or later (request 10/29).
  const span = visibleSpan(columns.flatMap((column) => column.events));
  const dayStart = fixedStart ?? span.start;
  const dayEnd = fixedEnd ?? span.end;
  const height = (dayEnd - dayStart) * pxPerMin;
  const hours = Array.from({ length: (dayEnd - dayStart) / 60 + 1 }, (_, i) => dayStart / 60 + i);
  const y = (minutes: number) =>
    (Math.min(Math.max(minutes, dayStart), dayEnd) - dayStart) * pxPerMin;
  const showsToday = columns.some((column) => column.date === now.date);
  const [drag, setDrag] = useState<{ key: string; anchor: number; current: number } | null>(null);
  const dragMoved = useRef(false);

  // Open on the working morning, or an hour before now when today is shown.
  const scrollKey = `${columns[0]?.date ?? ''}:${pxPerMin}`;
  useEffect(() => {
    const target = showsToday ? Math.max(dayStart, now.minutes - 90) : WORK_START - 60;
    scroller.current?.scrollTo({ top: y(target) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey]);

  const minutesAt = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return dayStart + (event.clientY - rect.top) / pxPerMin;
  };

  const finish = (column: GridColumn, start: number, end: number) => {
    const from = Math.max(dayStart, Math.min(start, end));
    const to = Math.min(dayEnd, Math.max(start, end, from + SLOT_MINUTES));
    onRange?.(column, hhmm(from), hhmm(to));
  };

  const allDayRow = columns.some((column) => column.events.some((event) => event.allDay));

  return (
    <div>
      <div
        ref={scroller}
        className="schedule-scroll relative overflow-auto border border-line bg-surface"
        style={{ maxHeight }}
      >
        <div className="min-w-max">
          {/* Header: who / which day and all-day items, sticky while the hours scroll. */}
          <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur-sm">
            <div className="flex border-b border-line">
              <div className="sticky left-0 z-10 w-14 shrink-0 bg-surface/95" />
              {columns.map((column) => (
                <div
                  key={column.key}
                  className={cn(
                    'flex-1 border-l border-line px-2 py-1.5',
                    column.date === now.date && 'shadow-[inset_0_2px_0_var(--color-main)]',
                  )}
                  style={{ minWidth: minColumnWidth }}
                >
                  {column.header}
                </div>
              ))}
            </div>
            {allDayRow && (
              <div className="flex border-b border-line bg-column/95">
                <div className="sticky left-0 flex w-14 shrink-0 items-center justify-end bg-column/95 pr-1.5 text-[10px] text-ink-sub">
                  終日
                </div>
                {columns.map((column) => (
                  <div
                    key={column.key}
                    className="flex flex-1 flex-col gap-0.5 border-l border-line p-1"
                    style={{ minWidth: minColumnWidth }}
                  >
                    {column.events
                      .filter((event) => event.allDay)
                      .map((event) => (
                        <button
                          key={event.key}
                          type="button"
                          onClick={() => onEvent(event)}
                          {...peek?.(event)}
                          className={cn(
                            'cursor-pointer truncate px-1.5 text-left text-[11px] leading-5 hover:brightness-95',
                            EVENT_STYLE[event.kind].chip,
                          )}
                        >
                          {event.title}
                        </button>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex">
            {/* Hour gutter */}
            <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-line bg-surface">
              <div className="relative" style={{ height }}>
                {hours.slice(1, -1).map((hour) => (
                  <span
                    key={hour}
                    className="absolute right-2 -translate-y-1/2 text-[11px] text-ink-sub tabular-nums"
                    style={{ top: (hour * 60 - dayStart) * pxPerMin }}
                  >
                    {hour}:00
                  </span>
                ))}
                {showsToday && now.minutes > dayStart && now.minutes < dayEnd && (
                  <span
                    className="absolute right-1 z-10 -translate-y-1/2 bg-now px-1 text-[10px] leading-4 font-bold text-white tabular-nums"
                    style={{ top: y(now.minutes) }}
                  >
                    {hhmm(now.minutes)}
                  </span>
                )}
              </div>
            </div>

            {columns.map((column) => {
              const placed = placeEvents(column.events, column.date).filter(
                (item) => item.end > dayStart && item.start < dayEnd,
              );
              const free = showFree && !column.off ? freeRanges(column.events, column.date) : [];
              const ghost =
                drag && drag.key === column.key
                  ? {
                      start: Math.min(drag.anchor, drag.current),
                      end: Math.max(
                        drag.anchor,
                        drag.current,
                        Math.min(drag.anchor, drag.current) + SLOT_MINUTES,
                      ),
                    }
                  : null;
              const isToday = column.date === now.date;
              return (
                <div
                  key={column.key}
                  role={onRange ? 'button' : undefined}
                  tabIndex={onRange ? 0 : undefined}
                  aria-label={onRange ? columnLabel?.(column) : undefined}
                  className={cn(
                    'relative flex-1 border-l border-line select-none',
                    column.off ? 'bg-weekend' : 'bg-surface',
                    onRange && 'cursor-cell',
                  )}
                  style={{ height, minWidth: minColumnWidth }}
                  onKeyDown={(event) => {
                    if (onRange && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      finish(column, WORK_START + 60, WORK_START + 120);
                    }
                  }}
                  onPointerDown={(event) => {
                    if (!onRange || event.button !== 0 || event.pointerType === 'touch') return;
                    if ((event.target as HTMLElement).closest('[data-event]')) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    const at = Math.floor(minutesAt(event) / SLOT_MINUTES) * SLOT_MINUTES;
                    dragMoved.current = false;
                    setDrag({ key: column.key, anchor: at, current: at + SLOT_MINUTES * 4 });
                  }}
                  onPointerMove={(event) => {
                    if (!drag || drag.key !== column.key) return;
                    const at = snap(minutesAt(event));
                    if (Math.abs(at - drag.anchor) >= SLOT_MINUTES) dragMoved.current = true;
                    if (dragMoved.current) {
                      setDrag({ ...drag, current: at === drag.anchor ? at + SLOT_MINUTES : at });
                    }
                  }}
                  onPointerUp={() => {
                    if (!drag || drag.key !== column.key) return;
                    setDrag(null);
                    finish(column, drag.anchor, drag.current);
                  }}
                  onPointerCancel={() => setDrag(null)}
                  onClick={(event) => {
                    // Touch: a tap makes a one-hour range (dragging would fight scrolling).
                    const native = event.nativeEvent as globalThis.PointerEvent;
                    if (!onRange || native.pointerType !== 'touch') return;
                    if ((event.target as HTMLElement).closest('[data-event]')) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    const at =
                      Math.floor(
                        (dayStart + (event.clientY - rect.top) / pxPerMin) / SLOT_MINUTES,
                      ) * SLOT_MINUTES;
                    finish(column, at, at + 60);
                  }}
                >
                  {/* Outside office hours */}
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 bg-canvas/80"
                    style={{ height: y(WORK_START) }}
                  />
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 bg-canvas/80"
                    style={{ top: y(WORK_END) }}
                  />
                  {/* Hour and half-hour lines */}
                  {hours.slice(1, -1).map((hour) => (
                    <div
                      key={hour}
                      className="pointer-events-none absolute inset-x-0 border-t border-line"
                      style={{ top: (hour * 60 - dayStart) * pxPerMin }}
                    />
                  ))}
                  {hours.slice(0, -1).map((hour) => (
                    <div
                      key={`h${hour}`}
                      className="pointer-events-none absolute inset-x-0 border-t border-dotted border-line/70"
                      style={{ top: (hour * 60 + 30 - dayStart) * pxPerMin }}
                    />
                  ))}

                  {free.map(([start, end]) => (
                    <div
                      key={start}
                      className="pointer-events-none absolute inset-x-1 flex items-start justify-end border border-dashed border-free-ink/30 bg-free/70 p-1"
                      style={{ top: y(start) + 1, height: y(end) - y(start) - 2 }}
                    >
                      <span className="bg-surface/80 px-1 text-[10px] font-bold text-free-ink">
                        空き {hoursLabel(end - start)}
                      </span>
                    </div>
                  ))}

                  {bufferMinutes > 0 &&
                    placed
                      .filter(
                        (item) =>
                          item.event.kind === 'appointment' ||
                          item.event.kind === 'salesAppointment',
                      )
                      .flatMap((item) => [
                        [item.start - bufferMinutes, item.start],
                        [item.end, item.end + bufferMinutes],
                      ])
                      .map(([start = 0, end = 0], index) => (
                        <div
                          key={`b${index}`}
                          aria-hidden="true"
                          title="移動時間"
                          className="pointer-events-none absolute inset-x-1 [background-image:repeating-linear-gradient(135deg,rgb(46_111_102/0.16)_0_3px,transparent_3px_7px)]"
                          style={{ top: y(start), height: Math.max(0, y(end) - y(start)) }}
                        />
                      ))}

                  {selection &&
                    selection.personId === column.personId &&
                    selection.date === column.date && (
                      <div
                        className="pointer-events-none absolute inset-x-1 z-[5] border-2 border-main bg-main/12 shadow-[0_0_0_4px_rgb(234_106_31/0.12)]"
                        style={{
                          top: y(toMinutes(selection.start)),
                          height: Math.max(
                            14,
                            y(toMinutes(selection.end)) - y(toMinutes(selection.start)),
                          ),
                        }}
                      >
                        <span className="absolute -top-5 left-0 bg-main px-1.5 text-[10px] leading-4 font-bold text-white tabular-nums">
                          {selection.start}–{selection.end}
                        </span>
                      </div>
                    )}

                  {placed.map(({ event, start, end, lane, lanes }) => {
                    const top = y(start);
                    const h = Math.max(18, y(end) - top - 2);
                    const tight = h < 34;
                    const style = EVENT_STYLE[event.kind];
                    const appointment = event.plan?.appointment;
                    return (
                      <button
                        key={event.key}
                        type="button"
                        data-event
                        onClick={(click) => {
                          click.stopPropagation();
                          onEvent(event);
                        }}
                        {...peek?.(event)}
                        className={cn(
                          'group absolute z-[6] cursor-pointer overflow-hidden px-1.5 text-left text-xs leading-4 transition-[box-shadow,filter] duration-150',
                          'hover:z-[7] hover:shadow-[0_4px_12px_-2px_rgb(30_37_48/0.25)] hover:brightness-[0.98]',
                          style.chip,
                          tight ? 'flex items-center gap-1 py-0' : 'py-1',
                        )}
                        style={{
                          top,
                          height: h,
                          left: `calc(${(lane / lanes) * 100}% + 3px)`,
                          width: `calc(${100 / lanes}% - 6px)`,
                        }}
                      >
                        {tight ? (
                          <>
                            <span className="shrink-0 font-bold tabular-nums">
                              {formatTime(event.startsAt)}
                            </span>
                            <span className="truncate">{event.title}</span>
                          </>
                        ) : (
                          <>
                            <span className="block truncate font-bold">{event.title}</span>
                            <span className="block truncate text-[11px] text-ink-sub tabular-nums">
                              {formatTime(event.startsAt)}–{formatTime(event.endsAt)}
                            </span>
                            {appointment && h > 52 && (
                              <span className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-sub">
                                {appointment.format === 'ONLINE' ? (
                                  <Video aria-hidden="true" className="size-3" />
                                ) : (
                                  <Building2 aria-hidden="true" className="size-3" />
                                )}
                                {appointment.format === 'ONLINE' ? 'Web' : '訪問'}
                              </span>
                            )}
                            {event.kind === 'lock' && (
                              <Lock
                                aria-hidden="true"
                                className="absolute top-1 right-1 size-3 text-warning-ink"
                              />
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}

                  {ghost && (
                    <div
                      className="pointer-events-none absolute inset-x-1 z-[8] border-2 border-main bg-main/15 shadow-(--shadow-raised)"
                      style={{ top: y(ghost.start), height: y(ghost.end) - y(ghost.start) }}
                    >
                      <span className="m-1 inline-block bg-main px-1.5 text-[11px] leading-4 font-bold text-white tabular-nums">
                        {hhmm(ghost.start)}–{hhmm(ghost.end)} ·{' '}
                        {hoursLabel(ghost.end - ghost.start)}
                      </span>
                    </div>
                  )}

                  {isToday && now.minutes > dayStart && now.minutes < dayEnd && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 z-[9] h-0.5 bg-now"
                      style={{ top: y(now.minutes) }}
                    >
                      <span className="absolute -top-[3px] -left-1 size-2 bg-now" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <ScrollPager target={scroller} stickyWidth={56} />
    </div>
  );
}
