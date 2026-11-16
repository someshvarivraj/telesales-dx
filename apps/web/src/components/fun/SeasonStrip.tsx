import { addDays, HolidayKind } from '@telesales/shared';
import { X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/components/ui/cn';
import { useHolidays } from '@/features/reference/useReference';
import { todayJst } from '@/lib/format';
import { type SeasonKey, seasonLine } from './season';

const storageKey = (userId: string, date: string) => `telesales.season.${userId}.${date}`;

/** Small seasonal pictures (drawn, not emoji), swaying gently. */
export function SeasonIcon({ season, className }: { season: SeasonKey; className?: string }) {
  const petals = (color: string, center: string) => (
    <>
      {[0, 72, 144, 216, 288].map((turn) => (
        <ellipse
          key={turn}
          cx="12"
          cy="6.5"
          rx="3.6"
          ry="5"
          fill={color}
          transform={`rotate(${turn} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="2.2" fill={center} />
    </>
  );
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('season-icon size-5 shrink-0', className)}
    >
      {season === 'momiji' && (
        <path
          fill="#e5391f"
          d="M12 1.5l1.2 3.6 2-1.6-.3 3.7 4.6-1.7-2 3.4 3.5.9-3.9 2.6 1.9 1.8-4.6.2.6 4.1-3-2.4-3 2.4.6-4.1-4.6-.2 1.9-1.8-3.9-2.6 3.5-.9-2-3.4 4.6 1.7-.3-3.7 2 1.6z M12 15.5v7"
          stroke="#c4291a"
          strokeWidth="0.8"
        />
      )}
      {season === 'sakura' && petals('#f7a8c4', '#e0607e')}
      {season === 'plum' && petals('#e8517a', '#ffd34d')}
      {season === 'green' && (
        <path
          fill="#4caf50"
          d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16zm0 0l9-9"
          stroke="#2e7d32"
          strokeWidth="1"
        />
      )}
      {season === 'rain' && (
        <>
          <path fill="#7c8fd6" d="M12 3a8 8 0 0 1 8 8H4a8 8 0 0 1 8-8z" />
          <path d="M12 11v7a2 2 0 0 0 4 0" fill="none" stroke="#4a5a9c" strokeWidth="1.5" />
        </>
      )}
      {season === 'summer' && (
        <>
          <path d="M8 4h8l-1 6H9z" fill="#9fd3f0" stroke="#3b8dbd" strokeWidth="1" />
          <path d="M12 10v6" stroke="#3b8dbd" strokeWidth="1" />
          <rect x="10" y="16" width="4" height="5" fill="#f26b5b" />
        </>
      )}
      {season === 'moon' && (
        <>
          <circle cx="12" cy="10" r="7" fill="#ffe08a" />
          <path d="M5 21c2-3 4-4 7-4s5 1 7 4" fill="none" stroke="#c9a24a" strokeWidth="1.5" />
        </>
      )}
      {season === 'snow' && (
        <g stroke="#6aa8d8" strokeWidth="1.6" strokeLinecap="round">
          {[0, 60, 120].map((turn) => (
            <path
              key={turn}
              d="M12 2v20M9 4.5l3 3 3-3M9 19.5l3-3 3 3"
              fill="none"
              transform={`rotate(${turn} 12 12)`}
            />
          ))}
        </g>
      )}
    </svg>
  );
}

/**
 * A thin strip at the top of every page (11/16): the season or a day everyone knows (正月, 節分,
 * お盆…) and the public holiday from the calendar. Closed with × for the rest of the day.
 */
export function SeasonStrip({ userId }: { userId: string }) {
  const today = todayJst();
  const tomorrow = addDays(today, 1);
  const holidays = useHolidays(today, tomorrow);
  const nameOn = (date: string) =>
    holidays.data?.find((day) => day.date === date && day.kind === HolidayKind.PublicHoliday)
      ?.name ?? null;
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(storageKey(userId, today)) === '1';
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  const line = seasonLine(today, nameOn(today), nameOn(tomorrow));
  return (
    <div
      className={cn(
        'season-strip mb-4 flex items-center gap-2.5 border border-line bg-surface py-1.5 pr-1.5 pl-3 text-sm shadow-(--shadow-card)',
        `season-${line.key}`,
      )}
    >
      <SeasonIcon season={line.key} />
      <p className="min-w-0 flex-1 truncate text-ink">{line.text}</p>
      <button
        type="button"
        aria-label="今日は表示しない"
        title="今日は表示しない"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(storageKey(userId, today), '1');
          } catch {
            // Storage blocked: it comes back after a reload.
          }
        }}
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center text-ink-sub hover:bg-column hover:text-ink"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
