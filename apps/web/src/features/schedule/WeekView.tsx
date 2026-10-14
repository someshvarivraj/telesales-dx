import type { CalendarDayDto, UserRef } from '@telesales/shared';
import { addDays, isWeekend } from '@telesales/shared';
import { cn } from '@/components/ui/cn';
import { formatShortDate, todayJst } from '@/lib/format';
import { EventChip } from './EventChip';
import { type CalendarEvent, eventsOn } from './events';

interface WeekViewProps {
  start: string;
  people: UserRef[];
  events: CalendarEvent[];
  holidays: CalendarDayDto[];
  onEvent: (event: CalendarEvent) => void;
  onDay: (personId: string, date: string) => void;
}

/** Group week view: one row per person, one column per day (like a team scheduler). */
export function WeekView({ start, people, events, holidays, onEvent, onDay }: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const holidayName = (date: string) => holidays.find((holiday) => holiday.date === date)?.name;
  const today = todayJst();
  return (
    <div className="overflow-x-auto rounded-(--radius-card) border border-line bg-surface">
      <table className="w-full min-w-[860px] table-fixed border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-32 border-b border-line bg-column px-2 py-2 text-left text-xs text-ink-sub">
              担当
            </th>
            {days.map((date) => {
              const off = isWeekend(date) || Boolean(holidayName(date));
              return (
                <th
                  key={date}
                  className={cn(
                    'border-b border-l border-line px-2 py-2 text-left text-xs font-bold',
                    off ? 'bg-danger-soft text-danger' : 'bg-column text-ink-sub',
                    date === today && 'text-main',
                  )}
                >
                  <button
                    type="button"
                    className="cursor-pointer hover:underline"
                    onClick={() => people[0] && onDay(people[0].id, date)}
                  >
                    {formatShortDate(date)}
                  </button>
                  {holidayName(date) && (
                    <div className="truncate font-normal">{holidayName(date)}</div>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.id}>
              <th
                scope="row"
                className="sticky left-0 z-10 border-b border-line bg-surface px-2 py-2 text-left align-top text-sm font-bold"
              >
                {person.name}
              </th>
              {days.map((date) => {
                const dayEvents = eventsOn(events, date, person.id);
                const off = isWeekend(date) || Boolean(holidayName(date));
                return (
                  <td
                    key={date}
                    className={cn(
                      'h-20 border-b border-l border-line p-1 align-top',
                      off && 'bg-danger-soft/40',
                    )}
                  >
                    <div className="flex flex-col gap-0.5">
                      {dayEvents.map((event) => (
                        <EventChip key={event.key} event={event} onClick={onEvent} />
                      ))}
                      <button
                        type="button"
                        aria-label={`${person.name} ${formatShortDate(date)} を開く`}
                        onClick={() => onDay(person.id, date)}
                        className="h-5 w-full cursor-pointer rounded-sm hover:bg-column"
                      />
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
