import type { CalendarDayDto } from '@telesales/shared';
import { addDays, isWeekend } from '@telesales/shared';
import { cn } from '@/components/ui/cn';
import { monthRange, startOfWeek, todayJst } from '@/lib/format';
import { EventChip } from './EventChip';
import { type CalendarEvent, eventsOn } from './events';

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

interface MonthViewProps {
  month: string;
  personId: string;
  events: CalendarEvent[];
  holidays: CalendarDayDto[];
  onEvent: (event: CalendarEvent) => void;
  onDay: (date: string) => void;
}

/** One person's month. */
export function MonthView({ month, personId, events, holidays, onEvent, onDay }: MonthViewProps) {
  const { from, to } = monthRange(month);
  const weeks: string[][] = [];
  for (let weekStart = startOfWeek(from); weekStart <= to; weekStart = addDays(weekStart, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)));
  }
  const today = todayJst();
  return (
    <div className="overflow-hidden rounded-(--radius-card) border border-line bg-surface">
      <div className="grid grid-cols-7 bg-column text-center text-xs font-bold text-ink-sub">
        {WEEKDAYS.map((label, index) => (
          <div key={label} className={cn('py-1.5', index >= 5 && 'text-danger')}>
            {label}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className="grid grid-cols-7">
          {week.map((date) => {
            const holiday = holidays.find((day) => day.date === date);
            const inMonth = date >= from && date <= to;
            const dayEvents = eventsOn(events, date, personId);
            return (
              <div
                key={date}
                className={cn(
                  'min-h-24 border-t border-l border-line p-1 first:border-l-0',
                  (isWeekend(date) || holiday) && 'bg-danger-soft/40',
                  !inMonth && 'opacity-50',
                )}
              >
                <button
                  type="button"
                  onClick={() => onDay(date)}
                  className={cn(
                    'mb-0.5 cursor-pointer rounded px-1 text-xs font-bold hover:bg-column',
                    date === today && 'bg-main text-white hover:bg-main-hover',
                  )}
                >
                  {Number(date.slice(8))}
                </button>
                {holiday && (
                  <div className="truncate px-1 text-[10px] text-danger">{holiday.name}</div>
                )}
                <div className="flex flex-col gap-0.5">
                  {dayEvents.slice(0, 4).map((event) => (
                    <EventChip key={event.key} event={event} onClick={onEvent} compact />
                  ))}
                  {dayEvents.length > 4 && (
                    <button
                      type="button"
                      onClick={() => onDay(date)}
                      className="cursor-pointer text-left text-[11px] text-link"
                    >
                      ほか{dayEvents.length - 4}件
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
