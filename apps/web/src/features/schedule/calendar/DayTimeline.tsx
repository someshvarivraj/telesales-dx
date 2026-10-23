import type { UserRef } from '@telesales/shared';
import { SLOT_MINUTES } from '@telesales/shared';
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui/cn';
import { formatTime } from '@/lib/format';
import { type CalendarEvent, EVENT_STYLE, eventsOn } from '../events';
import { Avatar } from './Avatar';
import type { PeekBinder } from './EventPeek';
import {
  freeMinutes,
  freeRanges,
  hhmm,
  hoursLabel,
  placeEvents,
  WORK_END,
  WORK_START,
} from './layout';
import { personColor } from './people';
import { useNow } from './TimeGrid';

const START = 7 * 60;
const END = 21 * 60;
const NAME_W = 184;

interface DayTimelineProps {
  date: string;
  people: UserRef[];
  events: CalendarEvent[];
  off: boolean;
  onEvent: (event: CalendarEvent) => void;
  peek?: PeekBinder;
  onRange?: (personId: string, start: string, end: string) => void;
  showFree?: boolean;
  /** Horizontal zoom. */
  pxPerMin?: number;
  colorOrder: string[];
  corner?: ReactNode;
}

/**
 * One day for many people: a row per person and time running left to right, as in
 * Teams' Scheduling Assistant — it stays readable with a hundred reps, where columns
 * would not. Drag along a row to make a plan; free stretches can be marked.
 */
export function DayTimeline({
  date,
  people,
  events,
  off,
  onEvent,
  peek,
  onRange,
  showFree = false,
  pxPerMin = 1,
  colorOrder,
  corner,
}: DayTimelineProps) {
  const scale = 1.25 * pxPerMin;
  const width = (END - START) * scale;
  const x = (minutes: number) => (Math.min(Math.max(minutes, START), END) - START) * scale;
  const hours = Array.from({ length: (END - START) / 60 + 1 }, (_, i) => START / 60 + i);
  const now = useNow();
  const scroller = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; anchor: number; current: number } | null>(null);

  useEffect(() => {
    const target = now.date === date ? now.minutes - 120 : WORK_START - 30;
    scroller.current?.scrollTo({ left: Math.max(0, x(target)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, pxPerMin]);

  const minutesAt = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return START + (event.clientX - rect.left) / scale;
  };

  return (
    <div
      ref={scroller}
      className="scroll-quiet relative overflow-auto border border-line bg-surface"
      style={{ maxHeight: 'calc(100dvh - 15rem)' }}
    >
      <div style={{ width: width + NAME_W }}>
        {/* Hour ruler */}
        <div className="sticky top-0 z-20 flex border-b border-line bg-surface/95 backdrop-blur-sm">
          <div
            className="sticky left-0 z-10 flex items-end border-r border-line bg-surface px-2 py-1.5 text-[11px] font-bold text-ink-sub"
            style={{ width: NAME_W, minWidth: NAME_W }}
          >
            {corner ?? `${people.length}人`}
          </div>
          <div className="relative self-stretch" style={{ width, minHeight: 36 }}>
            {hours.slice(0, -1).map((hour) => (
              <span
                key={hour}
                className="absolute bottom-1.5 pl-1.5 text-[11px] text-ink-sub tabular-nums"
                style={{ left: x(hour * 60) }}
              >
                {hour}:00
              </span>
            ))}
            {now.date === date && now.minutes > START && now.minutes < END && (
              <span
                className="absolute bottom-0 -translate-x-1/2 bg-now px-1 text-[10px] leading-4 font-bold text-white tabular-nums"
                style={{ left: x(now.minutes) }}
              >
                {hhmm(now.minutes)}
              </span>
            )}
          </div>
        </div>

        {people.map((person) => {
          const personEvents = eventsOn(events, date, person.id);
          const timed = placeEvents(personEvents, date).filter(
            (item) => item.end > START && item.start < END,
          );
          const allDay = personEvents.filter((event) => event.allDay);
          const lanes = Math.max(1, ...timed.map((item) => item.lanes));
          const rowH = Math.max(44, lanes * 22 + 8);
          const free = off ? 0 : freeMinutes(personEvents, date);
          const ghost =
            drag?.id === person.id
              ? {
                  start: Math.min(drag.anchor, drag.current),
                  end: Math.max(drag.anchor, drag.current),
                }
              : null;
          return (
            <div key={person.id} className="group/row flex border-b border-line last:border-b-0">
              <div
                className="sticky left-0 z-10 flex items-center gap-2 border-r border-line bg-surface px-3 group-hover/row:bg-column"
                style={{ width: NAME_W, minWidth: NAME_W }}
              >
                <Avatar size="sm" name={person.name} color={personColor(person.id, colorOrder)} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] leading-4 font-bold">{person.name}</p>
                  <p className="truncate text-[10px] leading-4 text-ink-sub">
                    {allDay.length > 0
                      ? allDay.map((event) => event.title).join('・')
                      : off
                        ? '休日'
                        : `空き ${hoursLabel(free)}`}
                  </p>
                </div>
              </div>
              <div
                role={onRange ? 'button' : undefined}
                aria-label={onRange ? `${person.name}の空き時間を選ぶ` : undefined}
                tabIndex={onRange ? 0 : undefined}
                className={cn(
                  'relative select-none',
                  off ? 'bg-weekend' : '',
                  onRange && 'cursor-cell',
                )}
                style={{
                  width,
                  height: `max(${rowH}px, calc((100dvh - 22rem) / ${people.length}))`,
                }}
                onKeyDown={(event) => {
                  if (onRange && event.key === 'Enter') onRange(person.id, '10:00', '11:00');
                }}
                onPointerDown={(event) => {
                  if (!onRange || event.button !== 0 || event.pointerType === 'touch') return;
                  if ((event.target as HTMLElement).closest('[data-event]')) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  const at = Math.floor(minutesAt(event) / SLOT_MINUTES) * SLOT_MINUTES;
                  setDrag({ id: person.id, anchor: at, current: at + 60 });
                }}
                onPointerMove={(event) => {
                  if (drag?.id !== person.id) return;
                  const at = Math.round(minutesAt(event) / SLOT_MINUTES) * SLOT_MINUTES;
                  if (Math.abs(at - drag.anchor) >= SLOT_MINUTES) setDrag({ ...drag, current: at });
                }}
                onPointerUp={() => {
                  if (drag?.id !== person.id) return;
                  setDrag(null);
                  const start = Math.min(drag.anchor, drag.current);
                  const end = Math.max(drag.anchor, drag.current, start + SLOT_MINUTES);
                  onRange?.(person.id, hhmm(Math.max(START, start)), hhmm(Math.min(END, end)));
                }}
                onPointerCancel={() => setDrag(null)}
              >
                {/* Outside office hours, hour lines */}
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 bg-canvas/80"
                  style={{ width: x(WORK_START) }}
                />
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 bg-canvas/80"
                  style={{ left: x(WORK_END) }}
                />
                {hours.slice(1, -1).map((hour) => (
                  <div
                    key={hour}
                    className="pointer-events-none absolute inset-y-0 border-l border-line/80"
                    style={{ left: x(hour * 60) }}
                  />
                ))}
                {showFree &&
                  !off &&
                  freeRanges(personEvents, date).map(([start, end]) => (
                    <div
                      key={start}
                      className="pointer-events-none absolute inset-y-1 border border-dashed border-free-ink/30 bg-free/70"
                      style={{ left: x(start) + 1, width: x(end) - x(start) - 2 }}
                    />
                  ))}
                {timed.map(({ event, start, end, lane }) => {
                  const w = Math.max(6, x(end) - x(start) - 2);
                  return (
                    <button
                      key={event.key}
                      type="button"
                      data-event
                      onClick={() => onEvent(event)}
                      {...peek?.(event)}
                      className={cn(
                        'absolute z-[2] flex cursor-pointer items-center gap-1 overflow-hidden px-1.5 text-left text-[11px] leading-4 whitespace-nowrap transition-shadow hover:z-[3] hover:shadow-[0_4px_12px_-2px_rgb(30_37_48/0.25)]',
                        EVENT_STYLE[event.kind].chip,
                      )}
                      style={{ left: x(start) + 1, width: w, top: 4 + lane * 22, height: 20 }}
                    >
                      {w > 130 && (
                        <span className="font-bold tabular-nums">{formatTime(event.startsAt)}</span>
                      )}
                      {w > 30 && <span className="truncate">{event.title}</span>}
                    </button>
                  );
                })}
                {ghost && (
                  <div
                    className="pointer-events-none absolute inset-y-0.5 z-[4] flex items-center border-2 border-main bg-main/15"
                    style={{ left: x(ghost.start), width: x(ghost.end) - x(ghost.start) }}
                  >
                    <span className="ml-1 bg-main px-1 text-[10px] leading-4 font-bold whitespace-nowrap text-white tabular-nums">
                      {hhmm(ghost.start)}–{hhmm(ghost.end)}
                    </span>
                  </div>
                )}
                {now.date === date && now.minutes > START && now.minutes < END && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 z-[5] w-0.5 bg-now"
                    style={{ left: x(now.minutes) }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
