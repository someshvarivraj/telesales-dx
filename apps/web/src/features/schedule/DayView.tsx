import type { CalendarDayDto, UserRef } from '@telesales/shared';
import { isWeekend, SLOT_MINUTES } from '@telesales/shared';
import { cn } from '@/components/ui/cn';
import { formatTime } from '@/lib/format';
import { type CalendarEvent, EVENT_STYLE, eventsOn, minutesWithin } from './events';

const DAY_START = 7 * 60;
const DAY_END = 21 * 60;
const PX_PER_MIN = 0.8;

interface DayViewProps {
  date: string;
  people: UserRef[];
  events: CalendarEvent[];
  holidays: CalendarDayDto[];
  onEvent: (event: CalendarEvent) => void;
  /** Clicking an empty slot (snapped to 15 minutes). */
  onSlot?: (personId: string, time: string) => void;
  /** Highlight the slot being booked. */
  selection?: { personId: string; start: string; end: string } | null;
}

function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function toMinutes(time: string): number {
  const [hours = 0, mins = 0] = time.split(':').map(Number);
  return hours * 60 + mins;
}

/** Time grid for one day: one column per person, 07:00–21:00, 15-minute snapping. */
export function DayView({
  date,
  people,
  events,
  holidays,
  onEvent,
  onSlot,
  selection,
}: DayViewProps) {
  const height = (DAY_END - DAY_START) * PX_PER_MIN;
  const hours = Array.from(
    { length: (DAY_END - DAY_START) / 60 },
    (_, index) => DAY_START / 60 + index,
  );
  const holiday = holidays.find((day) => day.date === date);
  const off = isWeekend(date) || Boolean(holiday);

  return (
    <div className="overflow-x-auto rounded-(--radius-card) border border-line bg-surface">
      {holiday && (
        <div className="border-b border-line bg-danger-soft px-3 py-1.5 text-xs font-bold text-danger">
          {holiday.name}（アポは入れられません）
        </div>
      )}
      <div className="flex min-w-max">
        <div className="w-14 shrink-0 border-r border-line">
          <div className="h-10 border-b border-line" />
          <div className="relative" style={{ height }}>
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute right-1.5 -translate-y-1/2 text-[11px] text-ink-sub tabular-nums"
                style={{ top: (hour * 60 - DAY_START) * PX_PER_MIN }}
              >
                {hour}:00
              </div>
            ))}
          </div>
        </div>
        {people.map((person) => {
          const personEvents = eventsOn(events, date, person.id);
          const allDay = personEvents.filter((event) => event.allDay);
          const timed = personEvents.filter((event) => !event.allDay);
          return (
            <div
              key={person.id}
              className="min-w-44 flex-1 border-r border-line last:border-r-0 sm:min-w-52"
            >
              <div className="flex h-10 flex-col justify-center border-b border-line bg-column px-2">
                <span className="truncate text-sm font-bold">{person.name}</span>
                {allDay.length > 0 && (
                  <span className="truncate text-[11px] text-ink-sub">
                    {allDay.map((event) => event.title).join('・')}
                  </span>
                )}
              </div>
              <div
                role={onSlot ? 'button' : undefined}
                tabIndex={onSlot ? 0 : undefined}
                aria-label={onSlot ? `${person.name}の空き時間を選ぶ` : undefined}
                className={cn('relative', off && 'bg-danger-soft/40', onSlot && 'cursor-cell')}
                style={{ height }}
                onClick={(event) => {
                  if (!onSlot) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  const minutes = DAY_START + (event.clientY - rect.top) / PX_PER_MIN;
                  const snapped = Math.min(
                    DAY_END - SLOT_MINUTES,
                    Math.max(DAY_START, Math.floor(minutes / SLOT_MINUTES) * SLOT_MINUTES),
                  );
                  onSlot(person.id, toTime(snapped));
                }}
              >
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="pointer-events-none absolute inset-x-0 border-t border-line"
                    style={{ top: (hour * 60 - DAY_START) * PX_PER_MIN }}
                  >
                    <div
                      className="border-t border-dashed border-line/60"
                      style={{ marginTop: 30 * PX_PER_MIN }}
                    />
                  </div>
                ))}
                {selection && selection.personId === person.id && (
                  <div
                    className="pointer-events-none absolute inset-x-1 rounded-sm border-2 border-main bg-main/15"
                    style={{
                      top: (toMinutes(selection.start) - DAY_START) * PX_PER_MIN,
                      height: Math.max(
                        12,
                        (toMinutes(selection.end) - toMinutes(selection.start)) * PX_PER_MIN,
                      ),
                    }}
                  />
                )}
                {timed.map((event) => {
                  const start = Math.max(DAY_START, minutesWithin(event.startsAt, date, 'start'));
                  const end = Math.min(DAY_END, minutesWithin(event.endsAt, date, 'end'));
                  if (end <= DAY_START || start >= DAY_END) return null;
                  return (
                    <button
                      key={event.key}
                      type="button"
                      onClick={(click) => {
                        click.stopPropagation();
                        onEvent(event);
                      }}
                      title={event.title}
                      className={cn(
                        'absolute inset-x-1 cursor-pointer overflow-hidden rounded-sm px-1.5 py-0.5 text-left text-xs leading-4 hover:brightness-95',
                        EVENT_STYLE[event.kind].chip,
                      )}
                      style={{
                        top: (start - DAY_START) * PX_PER_MIN,
                        height: Math.max(16, (end - start) * PX_PER_MIN - 2),
                      }}
                    >
                      <span className="font-bold tabular-nums">
                        {formatTime(event.startsAt)}–{formatTime(event.endsAt)}
                      </span>
                      <span className="block truncate">{event.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
