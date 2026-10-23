import type { CalendarDayDto, UserRef } from '@telesales/shared';
import { addDays, dayOfWeek, isWeekend } from '@telesales/shared';
import { cn } from '@/components/ui/cn';
import { formatTime, monthRange, startOfWeek, todayJst } from '@/lib/format';
import type { PeekBinder } from './calendar/EventPeek';
import { personColor } from './calendar/people';
import { type CalendarEvent, EVENT_STYLE, eventsOn } from './events';

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];
const SHOWN = 3;

interface MonthViewProps {
  month: string;
  people: UserRef[];
  events: CalendarEvent[];
  holidays: CalendarDayDto[];
  onEvent: (event: CalendarEvent) => void;
  onDay: (date: string) => void;
  peek?: PeekBinder;
  colorOrder?: string[];
}

/** The month for the people shown; with several people each item carries its owner's colour. */
export function MonthView({
  month,
  people,
  events,
  holidays,
  onEvent,
  onDay,
  peek,
  colorOrder,
}: MonthViewProps) {
  const { from, to } = monthRange(month);
  const weeks: string[][] = [];
  for (let weekStart = startOfWeek(from); weekStart <= to; weekStart = addDays(weekStart, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)));
  }
  const today = todayJst();
  const ids = new Set(people.map((person) => person.id));
  const order = colorOrder ?? people.map((person) => person.id);
  const several = people.length > 1;

  return (
    <div className="overflow-hidden border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line text-[11px] font-bold">
        {WEEKDAYS.map((label, index) => (
          <div
            key={label}
            className={cn(
              'px-2 py-1.5',
              index === 5 ? 'text-saturday' : index === 6 ? 'text-sunday' : 'text-ink-sub',
            )}
          >
            {label}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className="grid grid-cols-7">
          {week.map((date) => {
            const holiday = holidays.find((day) => day.date === date);
            const inMonth = date >= from && date <= to;
            const dayEvents = eventsOn(events, date).filter((event) => ids.has(event.personId));
            const dow = dayOfWeek(date);
            return (
              <div
                key={date}
                role="button"
                tabIndex={-1}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest('button')) return;
                  onDay(date);
                }}
                onKeyDown={() => undefined}
                className={cn(
                  'group min-h-28 cursor-pointer border-t border-l border-line p-1.5 transition-colors first:border-l-0 hover:bg-hover',
                  (isWeekend(date) || holiday) && 'bg-weekend',
                  !inMonth && 'bg-canvas/70',
                )}
              >
                <div className="mb-1 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onDay(date)}
                    aria-label={`${date}の日表示`}
                    className={cn(
                      'flex size-6 cursor-pointer items-center justify-center text-xs font-bold tabular-nums hover:bg-column',
                      !inMonth && 'text-ink-disabled',
                      inMonth && (dow === 0 || holiday) && 'text-sunday',
                      inMonth && dow === 6 && !holiday && 'text-saturday',
                      date === today && 'bg-main text-white hover:bg-main-hover',
                    )}
                  >
                    {Number(date.slice(8))}
                  </button>
                  {holiday && (
                    <span className="truncate text-[10px] text-sunday">{holiday.name}</span>
                  )}
                </div>
                <div className={cn('flex flex-col gap-0.5', !inMonth && 'opacity-60')}>
                  {dayEvents.slice(0, SHOWN).map((event) => (
                    <button
                      key={event.key}
                      type="button"
                      onClick={() => onEvent(event)}
                      {...peek?.(event)}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-1 truncate px-1 text-left text-[11px] leading-5',
                        event.allDay ? EVENT_STYLE[event.kind].chip : 'hover:bg-column',
                      )}
                    >
                      {!event.allDay && (
                        <span
                          aria-hidden="true"
                          className={cn('size-2 shrink-0', !several && EVENT_STYLE[event.kind].dot)}
                          style={
                            several
                              ? { backgroundColor: personColor(event.personId, order) }
                              : undefined
                          }
                        />
                      )}
                      {!event.allDay && (
                        <span className="shrink-0 text-ink-sub tabular-nums">
                          {formatTime(event.startsAt)}
                        </span>
                      )}
                      <span className="truncate max-sm:hidden">{event.title}</span>
                    </button>
                  ))}
                  {dayEvents.length > SHOWN && (
                    <button
                      type="button"
                      onClick={() => onDay(date)}
                      className="cursor-pointer px-1 text-left text-[11px] font-bold text-link hover:underline"
                    >
                      ほか{dayEvents.length - SHOWN}件
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
