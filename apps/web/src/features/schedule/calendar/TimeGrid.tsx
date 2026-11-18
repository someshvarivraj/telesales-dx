import { BOOKING_STEP_MINUTES, DEFAULT_PLAN_MINUTES, jstMinutesOfDay } from '@telesales/shared';
import { Building2, Lock, Video } from 'lucide-react';
import { Fragment, type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
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
  /** The person's whole day of 休み (11/17): hatched in the 休み grey, closed to new plans. */
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
  /**
   * Type an all-day plan straight into the 終日 row (11/18), as into the hours: a click on the
   * empty part of a day's cell opens a box; Enter saves, 「＋詳細」 opens the full form.
   */
  onQuickAddAllDay?: (column: GridColumn, title: string) => Promise<unknown>;
  onAllDayDetail?: (column: GridColumn, title: string) => void;
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
  onQuickAddAllDay,
  onAllDayDetail,
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

  const [allDayQuick, setAllDayQuick] = useState<{
    key: string;
    title: string;
    saving: boolean;
    error: string | null;
  } | null>(null);
  const saveAllDay = (column: GridColumn) => {
    if (!allDayQuick || !onQuickAddAllDay || allDayQuick.saving) return;
    const title = allDayQuick.title.trim();
    if (!title) return;
    setAllDayQuick({ ...allDayQuick, saving: true, error: null });
    onQuickAddAllDay(column, title).then(
      () => setAllDayQuick(null),
      (error: unknown) =>
        setAllDayQuick((current) =>
          current ? { ...current, saving: false, error: errorMessageOf(error) } : current,
        ),
    );
  };

  // Always there when all-day plans can be typed in, so the row is a place to write.
  const allDayRow =
    Boolean(onQuickAddAllDay) ||
    columns.some((column) => column.events.some((event) => event.allDay));

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
                    className={cn(
                      'flex flex-1 flex-col gap-0.5 border-l border-line p-1',
                      column.dayOff && !column.off && 'bg-dayoff',
                    )}
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
                    {onQuickAddAllDay &&
                      !column.off &&
                      (allDayQuick?.key === column.key ? (
                        <div data-quick className="flex flex-col gap-1">
                          <input
                            autoFocus
                            aria-label="終日の予定の件名"
                            placeholder="終日の予定（Enterで保存）"
                            value={allDayQuick.title}
                            disabled={allDayQuick.saving}
                            maxLength={100}
                            onChange={(event) =>
                              setAllDayQuick({ ...allDayQuick, title: event.target.value })
                            }
                            onKeyDown={(event) => {
                              if (event.nativeEvent.isComposing) return;
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                saveAllDay(column);
                              }
                              if (event.key === 'Escape') setAllDayQuick(null);
                            }}
                            onBlur={(event) => {
                              // Leaving an empty box closes it; typed text waits for Enter.
                              const inside = event.relatedTarget?.closest('[data-quick]');
                              if (!inside && !allDayQuick.title.trim()) setAllDayQuick(null);
                            }}
                            className="h-6 w-full min-w-0 border border-main bg-surface px-1.5 text-[11px] text-ink outline-none"
                          />
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={!allDayQuick.title.trim() || allDayQuick.saving}
                              onClick={() => saveAllDay(column)}
                              className="h-5 cursor-pointer bg-main px-2 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {allDayQuick.saving ? '保存中…' : '保存'}
                            </button>
                            {onAllDayDetail && (
                              <button
                                type="button"
                                onClick={() => {
                                  onAllDayDetail(column, allDayQuick.title);
                                  setAllDayQuick(null);
                                }}
                                className="h-5 cursor-pointer border border-line-strong px-1.5 text-[10px] font-bold text-ink hover:bg-column"
                              >
                                ＋詳細
                              </button>
                            )}
                            <button
                              type="button"
                              aria-label="閉じる"
                              onClick={() => setAllDayQuick(null)}
                              className="ml-auto h-5 cursor-pointer px-1 text-[10px] text-ink-sub hover:text-ink"
                            >
                              ✕
                            </button>
                          </div>
                          {allDayQuick.error && (
                            <p className="text-[10px] text-danger">{allDayQuick.error}</p>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-label={`${column.date}：終日の予定を入力`}
                          onClick={() =>
                            setAllDayQuick({
                              key: column.key,
                              title: '',
                              saving: false,
                              error: null,
                            })
                          }
                          className="group min-h-5 flex-1 cursor-text px-1.5 text-left text-[11px] text-transparent hover:bg-hover hover:text-ink-disabled focus-visible:text-ink-disabled"
                        >
                          ＋ 終日の予定
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

            {columns.map((column, columnIndex) => {
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
                      <Fragment key={event.key}>
                        <button
                          key="chip"
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
                        {/* 参加 (11/17, as in Teams): online appointments open their meeting here. */}
                        {appointment?.meetingUrl && h >= 40 && (
                          <a
                            href={appointment.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-event
                            onClick={(click) => click.stopPropagation()}
                            className="absolute z-[7] flex h-5 items-center gap-1 bg-success px-1.5 text-[10px] font-bold text-white hover:brightness-110"
                            style={{
                              top: top + h - 24,
                              right: `calc(${(1 - (lane + 1) / lanes) * 100}% + 7px)`,
                            }}
                          >
                            <Video aria-hidden="true" className="size-3" />
                            参加
                          </a>
                        )}
                      </Fragment>
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
                      // A comfortable fixed width even in narrow columns; it may reach past the column.
                      className={cn(
                        'absolute z-[10] flex w-60 flex-col gap-1.5 border-2 border-main bg-surface p-2 shadow-(--shadow-raised)',
                        // Columns on the right open it towards the left, so it stays on screen.
                        columns.length > 1 && columnIndex >= columns.length / 2
                          ? 'right-1'
                          : 'left-1',
                      )}
                      style={{
                        top: y(quick.start),
                        minHeight: Math.max(76, y(quick.end) - y(quick.start)),
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <span className="flex items-baseline justify-between text-[11px] font-bold text-main tabular-nums">
                        {hhmm(quick.start)}–{hhmm(quick.end)}
                        <span className="font-normal text-ink-sub">Enterで保存</span>
                      </span>
                      <input
                        autoFocus
                        aria-label="件名"
                        placeholder="件名"
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
                          className="h-7 shrink-0 cursor-pointer bg-main px-3 text-xs font-bold whitespace-nowrap text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {quick.saving ? '保存中…' : '保存'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onRange?.(column, hhmm(quick.start), hhmm(quick.end), quick.title);
                            setQuick(null);
                          }}
                          className="h-7 shrink-0 cursor-pointer border border-line-strong px-2 text-xs font-bold whitespace-nowrap text-ink hover:bg-column"
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
