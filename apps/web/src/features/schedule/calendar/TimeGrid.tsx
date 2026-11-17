import { BOOKING_STEP_MINUTES, DEFAULT_PLAN_MINUTES, jstMinutesOfDay } from '@telesales/shared';
import { Building2, Lock, Video } from 'lucide-react';
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui/cn';
import { ja } from '@/i18n/ja';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatTime, todayJst } from '@/lib/format';
import { type CalendarEvent, EVENT_STYLE } from '../events';
import type { PeekBinder } from './EventPeek';
import {
  freeRanges,
  hhmm,
  hoursLabel,
  placeEvents,
  toMinutes,
  LUNCH_END,
  LUNCH_START,
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
  /** The person's whole day of 休み (11/17): its own lavender hatching, labelled, closed. */
  dayOff?: boolean;
  events: CalendarEvent[];
}

interface TimeGridProps {
  columns: GridColumn[];
  pxPerMin?: number;
  dayStart?: number;
  dayEnd?: number;
  onEvent: (event: CalendarEvent) => void;
  peek?: PeekBinder;
  /**
   * Drag (or click) on empty time: the range is snapped to `step` (30 minutes). With
   * `onQuickAdd` this is the 「詳細」 button of the type-in box, carrying what was typed.
   */
  onRange?: (column: GridColumn, start: string, end: string, title?: string) => void;
  /**
   * Type a plan straight into the grid (11/17): a click or drag on empty time opens a small box
   * there; Enter saves it with the typed 件名, 「詳細」 opens the full form instead.
   */
  onQuickAdd?: (column: GridColumn, start: string, end: string, title: string) => Promise<unknown>;
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
  /** Minutes a click or drag snaps to (30). */
  step?: number;
  /** Length of the range a single click makes (30 minutes). */
  clickMinutes?: number;
}

function snap(minutes: number, step: number): number {
  return Math.round(minutes / step) * step;
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
  onQuickAdd,
  selection,
  showFree = false,
  bufferMinutes = 0,
  maxHeight = 'calc(100dvh - 15rem)',
  minColumnWidth = 176,
  columnLabel,
  step = BOOKING_STEP_MINUTES,
  clickMinutes = DEFAULT_PLAN_MINUTES,
}: TimeGridProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const now = useNow();
  // 5:00–24:00 (request 11/11), opened scrolled to the morning.
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
  const [quick, setQuick] = useState<{
    key: string;
    start: number;
    end: number;
    title: string;
    saving: boolean;
    error: string | null;
  } | null>(null);

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
    const to = Math.min(dayEnd, Math.max(start, end, from + step));
    if (onQuickAdd) {
      setQuick({ key: column.key, start: from, end: to, title: '', saving: false, error: null });
      return;
    }
    onRange?.(column, hhmm(from), hhmm(to));
  };

  const saveQuick = (column: GridColumn) => {
    if (!quick || !onQuickAdd || quick.saving) return;
    const title = quick.title.trim();
    if (!title) return;
    setQuick({ ...quick, saving: true, error: null });
    onQuickAdd(column, hhmm(quick.start), hhmm(quick.end), title).then(
      () => setQuick(null),
      (error: unknown) =>
        setQuick((current) =>
          current ? { ...current, saving: false, error: errorMessageOf(error) } : current,
        ),
    );
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
                    className="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-ink-sub tabular-nums"
                    style={{ top: (hour * 60 - dayStart) * pxPerMin }}
                  >
                    {hour}:00
                  </span>
                ))}
                {/* Every 30 minutes (request 11/11), lighter than the hours. */}
                {pxPerMin >= 0.6 &&
                  hours
                    .slice(0, -1)
                    // The red now-label takes the place of a :30 it would cover.
                    .filter(
                      (hour) =>
                        !(showsToday && Math.abs(now.minutes - (hour * 60 + 30)) < 14 / pxPerMin),
                    )
                    .map((hour) => (
                      <span
                        key={`h${hour}`}
                        className="absolute right-2 -translate-y-1/2 text-[10px] text-ink-disabled tabular-nums"
                        style={{ top: (hour * 60 + 30 - dayStart) * pxPerMin }}
                      >
                        {hour}:30
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
              const closed = column.off || column.dayOff === true;
              const free = showFree && !closed ? freeRanges(column.events, column.date) : [];
              const ghost =
                drag && drag.key === column.key
                  ? {
                      start: Math.min(drag.anchor, drag.current),
                      end: Math.max(
                        drag.anchor,
                        drag.current,
                        Math.min(drag.anchor, drag.current) + step,
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
                    column.off ? 'bg-off' : column.dayOff ? 'bg-dayoff' : 'bg-surface',
                    // Weekends, holidays and a whole day of 休み cannot be booked (11/2, 11/17).
                    onRange && (closed ? 'cursor-not-allowed' : 'cursor-cell'),
                  )}
                  style={{ height, minWidth: minColumnWidth }}
                  onKeyDown={(event) => {
                    if (closed || (event.target as HTMLElement).closest('[data-quick]')) return;
                    if (onRange && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      finish(column, WORK_START + 60, WORK_START + 60 + clickMinutes);
                    }
                  }}
                  onPointerDown={(event) => {
                    if (!onRange || closed || event.button !== 0 || event.pointerType === 'touch')
                      return;
                    if ((event.target as HTMLElement).closest('[data-event]')) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    const at = Math.floor(minutesAt(event) / step) * step;
                    dragMoved.current = false;
                    setDrag({ key: column.key, anchor: at, current: at + clickMinutes });
                  }}
                  onPointerMove={(event) => {
                    if (!drag || drag.key !== column.key) return;
                    const at = snap(minutesAt(event), step);
                    if (Math.abs(at - drag.anchor) >= step) dragMoved.current = true;
                    if (dragMoved.current) {
                      setDrag({ ...drag, current: at === drag.anchor ? at + step : at });
                    }
                  }}
                  onPointerUp={() => {
                    if (!drag || drag.key !== column.key) return;
                    setDrag(null);
                    finish(column, drag.anchor, drag.current);
                  }}
                  onPointerCancel={() => setDrag(null)}
                  onClick={(event) => {
                    // Touch: a tap makes a range of clickMinutes (dragging would fight scrolling).
                    const native = event.nativeEvent as globalThis.PointerEvent;
                    if (!onRange || closed || native.pointerType !== 'touch') return;
                    if ((event.target as HTMLElement).closest('[data-event]')) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    const at =
                      Math.floor((dayStart + (event.clientY - rect.top) / pxPerMin) / step) * step;
                    finish(column, at, at + clickMinutes);
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
                  {/* A whole day of 休み: labelled every 3 hours, so a label shows wherever the
                      grid is scrolled (11/17). */}
                  {column.dayOff &&
                    !column.off &&
                    hours
                      .filter(
                        (hour) => hour % 3 === 0 && hour * 60 > dayStart && hour * 60 < dayEnd,
                      )
                      .map((hour) => (
                        <span
                          key={`off${hour}`}
                          className="pointer-events-none absolute inset-x-0 flex justify-center"
                          style={{ top: y(hour * 60) + 8 }}
                        >
                          <span className="border border-dayoff-line bg-surface/90 px-3 py-0.5 text-xs font-bold text-dayoff-ink">
                            休み
                          </span>
                        </span>
                      ))}
                  {/* Lunch break, in its own grey */}
                  {!closed && (
                    <div
                      className="pointer-events-none absolute inset-x-0 bg-lunch"
                      style={{ top: y(LUNCH_START), height: y(LUNCH_END) - y(LUNCH_START) }}
                    >
                      <span className="absolute top-0.5 right-1 text-[10px] text-ink-sub">
                        昼休み
                      </span>
                    </div>
                  )}
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
                      className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line"
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
                                {appointment.format === 'ONLINE'
                                  ? 'Web'
                                  : ja.format[appointment.format]}
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

                  {quick && quick.key === column.key && (
                    <div
                      data-event
                      data-quick
                      className="absolute inset-x-1 z-[10] flex flex-col gap-1 border-2 border-main bg-surface p-1.5 shadow-(--shadow-raised)"
                      style={{
                        top: y(quick.start),
                        minHeight: Math.max(76, y(quick.end) - y(quick.start)),
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <span className="text-[11px] font-bold text-main tabular-nums">
                        {hhmm(quick.start)}–{hhmm(quick.end)}
                      </span>
                      <input
                        autoFocus
                        aria-label="件名"
                        placeholder="件名を入力してEnter"
                        value={quick.title}
                        disabled={quick.saving}
                        maxLength={100}
                        onChange={(event) => setQuick({ ...quick, title: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.nativeEvent.isComposing) return;
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            saveQuick(column);
                          }
                          if (event.key === 'Escape') setQuick(null);
                        }}
                        className="h-8 w-full min-w-0 border border-line-strong bg-surface px-2 text-sm outline-none focus:border-main"
                      />
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={!quick.title.trim() || quick.saving}
                          onClick={() => saveQuick(column)}
                          className="h-7 cursor-pointer bg-main px-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {quick.saving ? '保存中…' : '保存'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onRange?.(column, hhmm(quick.start), hhmm(quick.end), quick.title);
                            setQuick(null);
                          }}
                          className="h-7 cursor-pointer border border-line-strong px-2 text-xs font-bold text-ink hover:bg-column"
                        >
                          ＋詳細
                        </button>
                        <button
                          type="button"
                          aria-label="閉じる"
                          onClick={() => setQuick(null)}
                          className="ml-auto h-7 cursor-pointer px-1.5 text-xs text-ink-sub hover:text-ink"
                        >
                          ✕
                        </button>
                      </div>
                      {quick.error && <p className="text-[11px] text-danger">{quick.error}</p>}
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
