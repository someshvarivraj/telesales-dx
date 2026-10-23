import type { CalendarDayDto, UserRef } from '@telesales/shared';
import { addDays, isWeekend } from '@telesales/shared';
import { CalendarCheck } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { formatDate, formatTime, todayJst } from '@/lib/format';
import { relativeDay } from '@/components/ui/DatePicker';
import { Avatar } from './calendar/Avatar';
import type { PeekBinder } from './calendar/EventPeek';
import { hoursLabel } from './calendar/layout';
import { personColor } from './calendar/people';
import { type CalendarEvent, EVENT_STYLE, eventsOn } from './events';

interface AgendaViewProps {
  from: string;
  days: number;
  people: UserRef[];
  events: CalendarEvent[];
  holidays: CalendarDayDto[];
  onEvent: (event: CalendarEvent) => void;
  peek?: PeekBinder;
  colorOrder?: string[];
}

/** Two weeks as a list, day by day — reads well on a phone and for a quick look ahead. */
export function AgendaView({
  from,
  days,
  people,
  events,
  holidays,
  onEvent,
  peek,
  colorOrder,
}: AgendaViewProps) {
  const ids = new Set(people.map((person) => person.id));
  const names = new Map(people.map((person) => [person.id, person.name]));
  const order = colorOrder ?? people.map((person) => person.id);
  const today = todayJst();
  const dates = Array.from({ length: days }, (_, index) => addDays(from, index));
  const filled = dates
    .map((date) => ({
      date,
      holiday: holidays.find((day) => day.date === date),
      items: eventsOn(events, date).filter((event) => ids.has(event.personId)),
    }))
    .filter((day) => day.items.length > 0 || day.holiday || day.date === today);

  if (filled.every((day) => day.items.length === 0)) {
    return (
      <div className="flex flex-col items-center gap-2 border border-line bg-surface py-16 text-ink-sub">
        <CalendarCheck aria-hidden="true" className="size-8" />
        <p className="text-sm">この期間の予定はありません。</p>
      </div>
    );
  }

  return (
    <ol className="border border-line bg-surface">
      {filled.map(({ date, holiday, items }) => {
        const hint = relativeDay(date, today);
        return (
          <li
            key={date}
            className="grid border-b border-line last:border-b-0 sm:grid-cols-[11rem_1fr]"
          >
            <div
              className={cn(
                'flex items-baseline gap-2 px-4 pt-3 sm:block sm:py-3',
                (isWeekend(date) || holiday) && 'sm:bg-weekend',
              )}
            >
              <p
                className={cn(
                  'text-sm font-bold tabular-nums',
                  date === today && 'text-main',
                  holiday && 'text-sunday',
                )}
              >
                {formatDate(date)}
              </p>
              <p className="text-[11px] text-ink-sub">
                {hint}
                {holiday && <span className="ml-1 text-sunday">{holiday.name}</span>}
              </p>
            </div>
            <ul className="flex flex-col py-1.5">
              {items.length === 0 && <li className="px-4 py-2 text-sm text-ink-sub">予定なし</li>}
              {items.map((event) => {
                const minutes = Math.round(
                  (new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime()) / 60_000,
                );
                return (
                  <li key={event.key}>
                    <button
                      type="button"
                      onClick={() => onEvent(event)}
                      {...peek?.(event)}
                      className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left hover:bg-hover"
                    >
                      <span className="w-24 shrink-0 text-xs text-ink-sub tabular-nums">
                        {event.allDay ? (
                          '終日'
                        ) : (
                          <>
                            <span className="font-bold text-ink">{formatTime(event.startsAt)}</span>
                            <span>–{formatTime(event.endsAt)}</span>
                          </>
                        )}
                      </span>
                      <span className={cn('h-8 w-[3px] shrink-0', EVENT_STYLE[event.kind].bar)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{event.title}</span>
                        <span className="block truncate text-[11px] text-ink-sub">
                          {EVENT_STYLE[event.kind].label}
                          {!event.allDay && ` · ${hoursLabel(minutes)}`}
                        </span>
                      </span>
                      {people.length > 1 && (
                        <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-sub max-sm:hidden">
                          <Avatar
                            size="sm"
                            name={names.get(event.personId) ?? ''}
                            color={personColor(event.personId, order)}
                          />
                          {names.get(event.personId)}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
