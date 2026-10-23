import type { CalendarDayDto, UserRef } from '@telesales/shared';
import { isWeekend } from '@telesales/shared';
import { cn } from '@/components/ui/cn';
import { Avatar } from './calendar/Avatar';
import type { PeekBinder } from './calendar/EventPeek';
import { freeMinutes, hoursLabel } from './calendar/layout';
import { personColor } from './calendar/people';
import { TimeGrid } from './calendar/TimeGrid';
import { type CalendarEvent, eventsOn } from './events';

interface DayViewProps {
  date: string;
  people: UserRef[];
  events: CalendarEvent[];
  holidays: CalendarDayDto[];
  onEvent: (event: CalendarEvent) => void;
  /** Clicking an empty slot (snapped to 15 minutes). */
  onSlot?: (personId: string, time: string) => void;
  /** Dragging over empty time: start and end. */
  onRange?: (personId: string, start: string, end: string) => void;
  /** Highlight the slot being booked. */
  selection?: { personId: string; start: string; end: string } | null;
  peek?: PeekBinder;
  showFree?: boolean;
  bufferMinutes?: number;
  pxPerMin?: number;
  colorOrder?: string[];
  maxHeight?: string;
}

/** One day, one column per person: who is free when, side by side (spec §6). */
export function DayView({
  date,
  people,
  events,
  holidays,
  onEvent,
  onSlot,
  onRange,
  selection,
  peek,
  showFree,
  bufferMinutes,
  pxPerMin = 1,
  colorOrder,
  maxHeight,
}: DayViewProps) {
  const holiday = holidays.find((day) => day.date === date);
  const off = isWeekend(date) || Boolean(holiday);
  const order = colorOrder ?? people.map((person) => person.id);

  return (
    <div className="flex flex-col">
      {holiday && (
        <div className="border border-b-0 border-line bg-danger-soft px-3 py-1.5 text-xs font-bold text-danger">
          {holiday.name}（アポは入れられません）
        </div>
      )}
      <TimeGrid
        pxPerMin={pxPerMin}
        maxHeight={maxHeight}
        onEvent={onEvent}
        peek={peek}
        showFree={showFree}
        bufferMinutes={bufferMinutes}
        selection={selection ? { ...selection, date } : null}
        columnLabel={(column) =>
          `${people.find((person) => person.id === column.personId)?.name ?? ''}の空き時間を選ぶ`
        }
        onRange={
          onRange || onSlot
            ? (column, start, end) => {
                if (onRange) onRange(column.personId, start, end);
                else onSlot?.(column.personId, start);
              }
            : undefined
        }
        columns={people.map((person) => {
          const personEvents = eventsOn(events, date, person.id);
          const appointments = personEvents.filter(
            (event) => event.kind === 'appointment' || event.kind === 'salesAppointment',
          ).length;
          const free = off ? 0 : freeMinutes(personEvents, date);
          return {
            key: person.id,
            date,
            personId: person.id,
            off,
            events: personEvents,
            header: (
              <div className="flex items-center gap-2">
                <Avatar name={person.name} color={personColor(person.id, order)} />
                <div className="min-w-0">
                  <p className="truncate text-sm leading-5 font-bold">{person.name}</p>
                  <p className="truncate text-[11px] leading-4 text-ink-sub">
                    {appointments > 0 && <span>アポ {appointments}件</span>}
                    {appointments > 0 && !off && <span> · </span>}
                    {!off && (
                      <span className={cn(free >= 60 ? 'text-free-ink' : 'text-ink-sub')}>
                        空き {hoursLabel(free)}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ),
          };
        })}
      />
    </div>
  );
}
