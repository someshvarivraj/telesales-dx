import type { CalendarDayDto, UserRef } from '@telesales/shared';
import { addDays, dayOfWeek, isWeekend, weekdayJa } from '@telesales/shared';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { formatShortDate, formatTime, todayJst } from '@/lib/format';
import { Avatar } from './calendar/Avatar';
import type { PeekBinder } from './calendar/EventPeek';
import { busyRanges, freeMinutes, hoursLabel, WORK_END, WORK_START } from './calendar/layout';
import { personColor } from './calendar/people';
import { type CalendarEvent, EVENT_STYLE, eventsOn, minutesWithin } from './events';

interface WeekViewProps {
  start: string;
  people: UserRef[];
  events: CalendarEvent[];
  holidays: CalendarDayDto[];
  onEvent: (event: CalendarEvent) => void;
  onDay: (personId: string, date: string) => void;
  onAdd?: (personId: string, date: string) => void;
  peek?: PeekBinder;
  showFree?: boolean;
  colorOrder?: string[];
  /** Top-left cell: who is shown and paging. */
  corner?: ReactNode;
}

const CHIPS = 3;
/** Bigger teams get shorter rows so more people fit on screen. */
const COMPACT_FROM = 8;

/**
 * The team's week: one row per person, one column per day (like a resource scheduler).
 * Each day carries a strip of the office hours with the busy parts filled in, so free
 * time is visible at a glance, and how many free hours are left.
 */
export function WeekView({
  start,
  people,
  events,
  holidays,
  onEvent,
  onDay,
  onAdd,
  peek,
  showFree = false,
  colorOrder,
  corner,
}: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const holidayName = (date: string) => holidays.find((holiday) => holiday.date === date)?.name;
  const today = todayJst();
  const order = colorOrder ?? people.map((person) => person.id);
  const compact = people.length >= COMPACT_FROM;
  const chips = compact ? 2 : CHIPS;
  const isAppointment = (event: CalendarEvent) =>
    event.kind === 'appointment' || event.kind === 'salesAppointment';

  return (
    <div className="scroll-quiet overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[880px] table-fixed border-collapse text-sm">
        {/* Weekends and holidays are narrower: nobody is booked there. */}
        <colgroup>
          <col className="w-44" />
          {days.map((date) => (
            <col
              key={date}
              style={{ width: isWeekend(date) || holidayName(date) ? '5.75rem' : undefined }}
            />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-surface">
          <tr>
            <th className="sticky left-0 z-10 w-44 border-b border-line bg-surface px-2 py-2 text-left align-bottom text-[11px] font-bold text-ink-sub">
              {corner ?? 'メンバー'}
            </th>
            {days.map((date) => {
              const holiday = holidayName(date);
              const dow = dayOfWeek(date);
              const count = events.filter(
                (event) =>
                  isAppointment(event) &&
                  people.some((p) => p.id === event.personId) &&
                  eventsOn([event], date).length > 0,
              ).length;
              return (
                <th
                  key={date}
                  className={cn(
                    'border-b border-l border-line px-2 pt-1.5 pb-1 text-left font-normal',
                    (isWeekend(date) || holiday) && 'bg-weekend',
                    date === today && 'shadow-[inset_0_2px_0_var(--color-main)]',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => people[0] && onDay(people[0].id, date)}
                    aria-label={`${formatShortDate(date)}の日表示`}
                    className="group flex w-full cursor-pointer items-end gap-1.5 whitespace-nowrap"
                  >
                    <span
                      className={cn(
                        'flex h-8 min-w-8 items-center justify-center px-1 text-xl leading-none font-bold tabular-nums transition-colors',
                        date === today ? 'bg-main text-white' : 'group-hover:bg-column',
                        date !== today && (dow === 0 || holiday) && 'text-sunday',
                        date !== today && dow === 6 && !holiday && 'text-saturday',
                      )}
                    >
                      {Number(date.slice(8))}
                    </span>
                    <span className="pb-0.5 text-[11px] text-ink-sub">
                      {weekdayJa(date)}
                      {count > 0 && <span className="ml-1 text-calls">アポ{count}</span>}
                    </span>
                  </button>
                  <p className="h-4 truncate text-[10px] text-sunday">{holiday ?? ''}</p>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {people.map((person) => {
            const color = personColor(person.id, order);
            const weekEvents = days.flatMap((date) => eventsOn(events, date, person.id));
            const weekAppointments = new Set(
              weekEvents.filter(isAppointment).map((event) => event.key),
            ).size;
            const weekFree = days
              .filter((date) => !isWeekend(date) && !holidayName(date))
              .reduce((sum, date) => sum + freeMinutes(eventsOn(events, date, person.id), date), 0);
            return (
              <tr key={person.id} className="group/row">
                <th
                  scope="row"
                  className="sticky left-0 z-[5] border-b border-line bg-surface px-3 py-2 text-left align-top font-normal group-hover/row:bg-column"
                >
                  <div className="flex items-center gap-2">
                    <Avatar name={person.name} color={color} />
                    <div className="min-w-0">
                      <p className="truncate text-sm leading-5 font-bold">{person.name}</p>
                      <p className="truncate text-[11px] leading-4 text-ink-sub">
                        アポ {weekAppointments} · 空き {hoursLabel(weekFree)}
                      </p>
                    </div>
                  </div>
                </th>
                {days.map((date) => {
                  const dayEvents = eventsOn(events, date, person.id);
                  const off = isWeekend(date) || Boolean(holidayName(date));
                  const free = off ? 0 : freeMinutes(dayEvents, date);
                  const span = WORK_END - WORK_START;
                  return (
                    <td
                      key={date}
                      // Rows share the screen height, so ten people fit without scrolling.
                      style={{
                        height: `max(${compact ? '3.5rem' : '5rem'}, calc((100dvh - 21rem) / ${people.length}))`,
                      }}
                      className={cn(
                        'group/cell relative border-b border-l border-line p-1.5 align-top transition-colors',
                        off ? 'bg-weekend' : 'hover:bg-hover',
                        showFree && !off && free >= 60 && 'bg-free/60',
                      )}
                    >
                      {/* Office hours 9–18, busy parts filled in. */}
                      {!off && (
                        <div
                          className="relative mb-1.5 h-1.5 bg-column"
                          title={`空き ${hoursLabel(free)}（9:00–18:00）`}
                        >
                          {dayEvents
                            .filter((event) => !event.allDay)
                            .map((event) => {
                              const from = Math.max(
                                WORK_START,
                                minutesWithin(event.startsAt, date, 'start'),
                              );
                              const to = Math.min(
                                WORK_END,
                                minutesWithin(event.endsAt, date, 'end'),
                              );
                              if (to <= from) return null;
                              return (
                                <span
                                  key={event.key}
                                  className={cn('absolute inset-y-0', EVENT_STYLE[event.kind].bar)}
                                  style={{
                                    left: `${((from - WORK_START) / span) * 100}%`,
                                    width: `${((to - from) / span) * 100}%`,
                                  }}
                                />
                              );
                            })}
                          {busyRanges(dayEvents, date).some(
                            ([a, b]) => a <= WORK_START && b >= WORK_END,
                          ) && <span className="absolute inset-0 bg-ink-sub/40" />}
                        </div>
                      )}
                      <div className="flex flex-col gap-0.5">
                        {dayEvents.slice(0, chips).map((event) => (
                          <button
                            key={event.key}
                            type="button"
                            onClick={() => onEvent(event)}
                            {...peek?.(event)}
                            className={cn(
                              'flex w-full cursor-pointer items-center gap-1 truncate px-1.5 text-left text-[11px] leading-5 transition-shadow hover:shadow-[0_2px_6px_-1px_rgb(30_37_48/0.2)]',
                              EVENT_STYLE[event.kind].chip,
                            )}
                          >
                            {!event.allDay && (
                              <span className="shrink-0 font-bold tabular-nums">
                                {formatTime(event.startsAt)}
                              </span>
                            )}
                            <span className="truncate">{event.title}</span>
                          </button>
                        ))}
                        {dayEvents.length > chips && (
                          <button
                            type="button"
                            onClick={() => onDay(person.id, date)}
                            className="cursor-pointer text-left text-[11px] font-bold text-link hover:underline"
                          >
                            ほか{dayEvents.length - chips}件
                          </button>
                        )}
                      </div>
                      {!compact && (
                        <div className="mt-1 flex justify-end">
                          {!off && free > 0 && (showFree || dayEvents.length > 0) && (
                            <span
                              className={cn(
                                'text-[10px] tabular-nums',
                                free >= 60 ? 'font-bold text-free-ink' : 'text-ink-sub',
                              )}
                            >
                              空き{hoursLabel(free)}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="absolute top-1 right-1 flex items-center gap-1">
                        {onAdd && (
                          <button
                            type="button"
                            aria-label={`${person.name} ${formatShortDate(date)} に予定を追加`}
                            onClick={() => onAdd(person.id, date)}
                            className="flex size-6 cursor-pointer items-center justify-center bg-main text-white opacity-0 shadow-sm transition-opacity group-hover/cell:opacity-100 focus:opacity-100"
                          >
                            <Plus aria-hidden="true" className="size-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={`${person.name} ${formatShortDate(date)} を開く`}
                          onClick={() => onDay(person.id, date)}
                          className="sr-only focus:not-sr-only focus:text-[11px]"
                        >
                          開く
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
