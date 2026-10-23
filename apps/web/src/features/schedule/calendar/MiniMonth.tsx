import type { CalendarDayDto } from '@telesales/shared';
import { addDays, dayOfWeek } from '@telesales/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/components/ui/cn';
import { monthRange, startOfWeek, todayJst } from '@/lib/format';

const WEEK = ['月', '火', '水', '木', '金', '土', '日'];

function shiftMonth(month: string, by: number): string {
  const [year, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, m - 1 + by, 1)).toISOString().slice(0, 10);
}

interface MiniMonthProps {
  /** The day the calendar is on. */
  date: string;
  /** The range the main view shows, tinted. */
  range: { from: string; to: string };
  holidays: CalendarDayDto[];
  /** How busy each day is (0–1) for the shown people: a small bar under the number. */
  load: (date: string) => number;
  onPick: (date: string) => void;
}

/** The small month in the side rail, as in Notion Calendar and Fantastical. */
export function MiniMonth({ date, range, holidays, load, onPick }: MiniMonthProps) {
  const [month, setMonth] = useState(() => `${date.slice(0, 7)}-01`);
  const [shownFor, setShownFor] = useState(date);
  // Follow the main calendar when it moves to another month.
  if (shownFor !== date) {
    setShownFor(date);
    if (date.slice(0, 7) !== month.slice(0, 7)) setMonth(`${date.slice(0, 7)}-01`);
  }
  const { from, to } = monthRange(month);
  const today = todayJst();
  const days: string[] = [];
  for (let day = startOfWeek(from); day <= to || days.length % 7 !== 0; day = addDays(day, 1)) {
    days.push(day);
  }
  const holidayOf = (day: string) => holidays.find((holiday) => holiday.date === day);

  return (
    <div>
      <div className="mb-1 flex items-center">
        <p className="flex-1 pl-1 text-sm font-bold tabular-nums">
          {Number(month.slice(0, 4))}年{Number(month.slice(5, 7))}月
        </p>
        <button
          type="button"
          aria-label="前の月"
          onClick={() => setMonth(shiftMonth(month, -1))}
          className="flex size-7 cursor-pointer items-center justify-center text-ink-sub hover:bg-column hover:text-ink"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          aria-label="次の月"
          onClick={() => setMonth(shiftMonth(month, 1))}
          className="flex size-7 cursor-pointer items-center justify-center text-ink-sub hover:bg-column hover:text-ink"
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-bold">
        {WEEK.map((label, index) => (
          <span
            key={label}
            className={cn(
              'py-0.5',
              index === 5 ? 'text-saturday' : index === 6 ? 'text-sunday' : 'text-ink-sub',
            )}
          >
            {label}
          </span>
        ))}
        {days.map((day) => {
          const inMonth = day >= from && day <= to;
          const inRange = day >= range.from && day <= range.to;
          const holiday = holidayOf(day);
          const dow = dayOfWeek(day);
          const busy = inMonth ? load(day) : 0;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onPick(day)}
              title={holiday?.name}
              aria-label={`${day}${holiday ? ` ${holiday.name}` : ''}`}
              aria-current={day === date ? 'date' : undefined}
              className={cn(
                'relative flex h-8 cursor-pointer flex-col items-center justify-center text-xs tabular-nums transition-colors',
                inRange && 'bg-main-soft',
                !inMonth && 'text-ink-disabled',
                inMonth && (dow === 0 || holiday) && 'text-sunday',
                inMonth && dow === 6 && !holiday && 'text-saturday',
                day !== date && 'hover:bg-column',
              )}
            >
              <span
                className={cn(
                  'flex size-6 items-center justify-center',
                  day === today && 'font-bold ring-1 ring-ink/70',
                  day === date && 'bg-main font-bold text-white ring-0',
                )}
              >
                {Number(day.slice(8))}
              </span>
              {busy > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0.5 h-[2px] bg-calls/70"
                  style={{ width: `${Math.max(3, Math.round(busy * 18))}px` }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
