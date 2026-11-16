import { addDays, isWeekend } from '@telesales/shared';
import { CalendarPlus, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { DatePicker } from '@/components/ui/DatePicker';
import { TimePicker } from '@/components/ui/TimePicker';
import { formatShortDate, startOfWeek, todayJst } from '@/lib/format';
import { useSchedule } from './api';
import { freeRanges, hhmm, toMinutes } from './calendar/layout';
import { buildEvents, eventsOn } from './events';

export interface Candidate {
  date: string;
  start: string;
  end: string;
}

const MAX_CANDIDATES = 9;
const DAYS_SHOWN = 5;

/**
 * 候補日 (request 11/12, 営業部): several candidate dates for one 仮予定, added with ＋ or picked
 * from the rep's free time in the week, so a meeting can be offered to a company in one go.
 * Used by 予定を追加 and by 自分で取ったアポの登録 when it is a 仮予定 (11/16).
 */
export function CandidateEditor({
  ownerId,
  first,
  candidates,
  onChange,
}: {
  ownerId: string;
  first: Candidate;
  candidates: Candidate[];
  onChange: (next: Candidate[]) => void;
}) {
  const [picking, setPicking] = useState(false);
  const all = [first, ...candidates];
  const length = Math.max(15, toMinutes(first.end) - toMinutes(first.start));
  const full = candidates.length >= MAX_CANDIDATES;
  const update = (index: number, patch: Partial<Candidate>) =>
    onChange(candidates.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  const nextDay = () => {
    let day = addDays(all[all.length - 1]?.date || first.date, 1);
    while (isWeekend(day)) day = addDays(day, 1);
    return day;
  };
  const taken = (slot: Candidate) =>
    all.some((c) => c.date === slot.date && c.start === slot.start && c.end === slot.end);

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-1.5">
        <li className="flex flex-wrap items-center gap-2 text-sm">
          <span className="flex size-6 items-center justify-center bg-ev-tentative-soft text-xs font-bold text-ev-tentative">
            1
          </span>
          <span className="font-medium">
            {first.date ? formatShortDate(first.date) : '―'} {first.start}〜{first.end}
          </span>
          <span className="text-xs text-ink-sub">（上の日時）</span>
        </li>
        {candidates.map((slot, index) => (
          <li key={index} className="flex flex-wrap items-center gap-2">
            <span className="flex size-6 items-center justify-center bg-ev-tentative-soft text-xs font-bold text-ev-tentative">
              {index + 2}
            </span>
            <DatePicker
              aria-label={`候補${index + 2}の日付`}
              className="w-60"
              value={slot.date}
              onChange={(e) => update(index, { date: e.target.value })}
            />
            <TimePicker
              aria-label={`候補${index + 2}の開始`}
              className="w-28"
              fromHour={6}
              toHour={22}
              value={slot.start}
              onChange={(e) =>
                update(index, {
                  start: e.target.value,
                  end: hhmm(Math.min(24 * 60, toMinutes(e.target.value) + length)),
                })
              }
            />
            <span className="text-ink-sub">〜</span>
            <TimePicker
              aria-label={`候補${index + 2}の終了`}
              className="w-40"
              fromHour={6}
              toHour={22}
              after={slot.start}
              durationFrom={slot.start}
              value={slot.end}
              onChange={(e) => update(index, { end: e.target.value })}
            />
            <button
              type="button"
              aria-label={`候補${index + 2}を外す`}
              onClick={() => onChange(candidates.filter((_, i) => i !== index))}
              className="flex size-8 cursor-pointer items-center justify-center text-ink-sub hover:bg-column hover:text-danger"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={full}
          icon={<Plus className="size-4" aria-hidden="true" />}
          onClick={() =>
            onChange([...candidates, { date: nextDay(), start: first.start, end: first.end }])
          }
        >
          候補日を追加
        </Button>
        <Button
          size="sm"
          variant={picking ? 'primary' : 'secondary'}
          disabled={!ownerId}
          icon={<CalendarPlus className="size-4" aria-hidden="true" />}
          onClick={() => setPicking((v) => !v)}
        >
          空き時間から選ぶ
        </Button>
        {full && <span className="self-center text-xs text-ink-sub">候補は10件までです。</span>}
      </div>
      {picking && ownerId && (
        <FreeSlotPicker
          ownerId={ownerId}
          from={first.date || todayJst()}
          length={length}
          isTaken={taken}
          disabled={full}
          onPick={(slot) => onChange([...candidates, slot])}
        />
      )}
    </div>
  );
}

/** The rep's free time (9:00–18:00) day by day; a click adds that time as a candidate. */
function FreeSlotPicker({
  ownerId,
  from,
  length,
  isTaken,
  disabled,
  onPick,
}: {
  ownerId: string;
  from: string;
  length: number;
  isTaken: (slot: Candidate) => boolean;
  disabled: boolean;
  onPick: (slot: Candidate) => void;
}) {
  const [week, setWeek] = useState(() => startOfWeek(from));
  const last = addDays(week, DAYS_SHOWN - 1);
  const schedule = useSchedule(week, last, [ownerId]);
  const events = useMemo(() => (schedule.data ? buildEvents(schedule.data) : []), [schedule.data]);
  const today = todayJst();
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(week, i));
  const holiday = (date: string) => schedule.data?.holidays.find((day) => day.date === date)?.name;

  return (
    <div className="border border-line bg-canvas p-3">
      <div className="mb-2 flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          aria-label="前の週"
          disabled={week <= startOfWeek(today)}
          icon={<ChevronLeft className="size-4" aria-hidden="true" />}
          onClick={() => setWeek(addDays(week, -7))}
        />
        <span className="text-sm font-bold">
          {formatShortDate(week)}〜{formatShortDate(last)}の空き時間
        </span>
        <Button
          size="sm"
          variant="secondary"
          aria-label="次の週"
          icon={<ChevronRight className="size-4" aria-hidden="true" />}
          onClick={() => setWeek(addDays(week, 7))}
        />
      </div>
      {!schedule.data ? (
        <p className="text-sm text-ink-sub">読み込み中…</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {days.map((date) => {
            const name = holiday(date);
            const free =
              date < today || name
                ? []
                : freeRanges(eventsOn(events, date, ownerId), date, { min: Math.min(length, 60) });
            return (
              <li key={date} className="grid grid-cols-[5.5rem_1fr] items-start gap-2">
                <span className="pt-1 text-sm font-bold">{formatShortDate(date)}</span>
                <div className="flex flex-wrap gap-1.5">
                  {name ? (
                    <span className="pt-1 text-xs text-sunday">{name}</span>
                  ) : date < today ? (
                    <span className="pt-1 text-xs text-ink-disabled">過ぎた日</span>
                  ) : free.length === 0 ? (
                    <span className="pt-1 text-xs text-ink-sub">空きなし</span>
                  ) : (
                    free.map(([start, end]) => {
                      const slot = {
                        date,
                        start: hhmm(start),
                        end: hhmm(Math.min(end, start + length)),
                      };
                      const on = isTaken(slot);
                      return (
                        <button
                          key={start}
                          type="button"
                          disabled={disabled || on}
                          onClick={() => onPick(slot)}
                          title={`${hhmm(start)}〜${hhmm(end)} が空いています`}
                          className={cn(
                            'h-7 cursor-pointer border px-2 text-xs tabular-nums transition-colors disabled:cursor-not-allowed',
                            on
                              ? 'border-ev-tentative bg-ev-tentative-soft font-bold text-ev-tentative'
                              : 'border-free-ink/30 bg-free text-free-ink hover:border-free-ink disabled:opacity-50',
                          )}
                        >
                          {on ? '✓ ' : '＋ '}
                          {hhmm(start)}〜{hhmm(end)}
                        </button>
                      );
                    })
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-ink-sub">
        クリックすると、その時間から上の日時と同じ長さで候補に入ります（9:00〜18:00の空きだけ表示）。
      </p>
    </div>
  );
}
