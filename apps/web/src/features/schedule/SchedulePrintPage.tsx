import { addDays, PREFECTURE_NAMES, TimeOffKind } from '@telesales/shared';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, MapPin, Printer, Users } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { paths } from '@/app/paths';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Spinner } from '@/components/ui/Spinner';
import { formatShortDate, formatTime, startOfWeek, todayJst } from '@/lib/format';
import { ja } from '@/i18n/ja';
import { useSchedule } from './api';
import {
  freeMinutes,
  freeRanges,
  hhmm,
  hoursLabel,
  LUNCH_END,
  LUNCH_START,
  WORK_END,
  WORK_START,
} from './calendar/layout';
import { buildEvents, type CalendarEvent, EVENT_STYLE, eventsOn, minutesWithin } from './events';

const WEEKDAYS = 5;
const SPAN = WORK_END - WORK_START;
/** Free stretches shorter than this are not worth printing. */
const MIN_FREE = 30;

/** How an entry is drawn on paper: the schedule's colours, plus 営業予定あり on its own. */
type PrintKind = CalendarEvent['kind'] | 'stop';

const PRINT_STYLE: Record<
  Exclude<PrintKind, 'lock'>,
  { label: string; chip: string; bar: string }
> = {
  appointment: { label: 'アポ（テレマ）', chip: EVENT_STYLE.appointment.chip, bar: 'bg-ev-telema' },
  salesAppointment: {
    label: 'アポ（営業）',
    chip: EVENT_STYLE.salesAppointment.chip,
    bar: 'bg-ev-sales',
  },
  plan: { label: '予定', chip: EVENT_STYLE.plan.chip, bar: 'bg-ev-plan' },
  tentative: { label: '仮予定', chip: EVENT_STYLE.tentative.chip, bar: 'bg-ev-tentative' },
  attending: { label: '同席', chip: EVENT_STYLE.attending.chip, bar: 'bg-ev-attend' },
  timeoff: { label: '休み', chip: EVENT_STYLE.timeoff.chip, bar: 'bg-ink-sub/70' },
  stop: {
    label: '営業予定あり（テレマアポ不可）',
    chip: 'border-l-[3px] border-ink-sub bg-off text-ink',
    bar: 'bg-off ring-1 ring-ink-sub/50 ring-inset',
  },
};

function printKind(event: CalendarEvent): Exclude<PrintKind, 'lock'> | null {
  if (event.kind === 'lock') return null;
  return event.timeOff?.kind === TimeOffKind.TelemaStop ? 'stop' : event.kind;
}

/** 9:00 rather than 09:00: shorter on paper. */
function short(minutes: number): string {
  return hhmm(minutes).replace(/^0/, '');
}

function x(minutes: number): string {
  return `${((Math.min(Math.max(minutes, WORK_START), WORK_END) - WORK_START) / SPAN) * 100}%`;
}

/** 9:00–18:00 at a glance: free in green, lunch in its grey, everything else in its colour. */
function DayBar({ events, date }: { events: CalendarEvent[]; date: string }) {
  const free = freeRanges(events, date, { min: 15 });
  return (
    <div className="relative mb-1 h-3 overflow-hidden border border-line-strong bg-surface">
      {free.map(([start, end]) => (
        <span
          key={`f${start}`}
          className="absolute inset-y-0 bg-success/60"
          style={{ left: x(start), width: `calc(${x(end)} - ${x(start)})` }}
        />
      ))}
      <span
        className="absolute inset-y-0 bg-lunch"
        style={{ left: x(LUNCH_START), width: `calc(${x(LUNCH_END)} - ${x(LUNCH_START)})` }}
      />
      {events.map((event) => {
        const kind = printKind(event);
        if (!kind) return null;
        const start = event.allDay ? WORK_START : minutesWithin(event.startsAt, date, 'start');
        const end = event.allDay ? WORK_END : minutesWithin(event.endsAt, date, 'end');
        if (end <= WORK_START || start >= WORK_END) return null;
        return (
          <span
            key={event.key}
            className={cn('absolute inset-y-0', PRINT_STYLE[kind].bar)}
            style={{ left: x(start), width: `calc(${x(end)} - ${x(start)})` }}
          />
        );
      })}
      {/* 12:00 and 15:00 ticks, so times can be read off the bar */}
      {[12 * 60, 15 * 60].map((minutes) => (
        <span
          key={minutes}
          className="absolute inset-y-0 w-px bg-ink/30"
          style={{ left: x(minutes) }}
        />
      ))}
    </div>
  );
}

/**
 * 週間予定の印刷 (11/2): every sales rep's Monday–Friday on landscape A4, made to be read on paper
 * at a glance — a 9–18 bar per day (free in green), the free slots written out, every entry in
 * the schedule's colours, and each rep's week in numbers.
 */
export function SchedulePrintPage() {
  const [params, setParams] = useSearchParams();
  const monday = startOfWeek(params.get('date') ?? todayJst());
  const friday = addDays(monday, WEEKDAYS - 1);
  const schedule = useSchedule(monday, addDays(monday, 6), []);
  const events = useMemo(() => (schedule.data ? buildEvents(schedule.data) : []), [schedule.data]);
  const days = Array.from({ length: WEEKDAYS }, (_, index) => addDays(monday, index));
  const sales = (schedule.data?.people ?? []).filter((person) => person.isSales);
  // Who is printed (request 11/11): everyone, the people picked, or the reps of some areas.
  const who = (params.get('who') as Who | null) ?? 'all';
  const ids = splitParam(params.get('ids'));
  const prefs = splitParam(params.get('pref'));
  const people =
    who === 'people'
      ? sales.filter((person) => ids.includes(person.id))
      : who === 'area'
        ? sales.filter((person) => person.prefectures.some((pref) => prefs.includes(pref)))
        : sales;
  const target =
    who === 'people'
      ? `選んだ営業`
      : who === 'area'
        ? prefs.length > 0
          ? prefs.join('・')
          : 'エリア未選択'
        : '営業全員';
  const setFilter = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };
  const holiday = (date: string) => schedule.data?.holidays.find((day) => day.date === date)?.name;
  const dayEvents = (personId: string, date: string) =>
    eventsOn(events, date, personId).filter((event) => event.kind !== 'lock');
  const freeOf = (personId: string, date: string) =>
    holiday(date) ? 0 : freeMinutes(dayEvents(personId, date), date);
  const navigate = useNavigate();
  // The print page opens in its own tab: closing it returns to the schedule left open there.
  // Opened on its own (a bookmark, a reload), the tab cannot be closed, so it goes to the schedule.
  const backToSchedule = () => {
    if (window.opener) {
      window.close();
    } else {
      navigate(`${paths.schedule}?date=${monday}`);
    }
  };
  const move = (weeks: number) => {
    const next = new URLSearchParams(params);
    next.set('date', addDays(monday, weeks * 7));
    setParams(next, { replace: true });
  };

  return (
    <div className="min-h-dvh bg-surface p-6 text-ink [print-color-adjust:exact] print:p-0">
      <style>
        {'@page { size: A4 landscape; margin: 7mm; } html { -webkit-print-color-adjust: exact; }'}
      </style>
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Button
          variant="secondary"
          icon={<ArrowLeft className="size-4" aria-hidden="true" />}
          onClick={backToSchedule}
        >
          スケジュールに戻る
        </Button>
        <Button
          variant="secondary"
          aria-label="前の週"
          icon={<ChevronLeft className="size-4" aria-hidden="true" />}
          onClick={() => move(-1)}
        />
        <Button
          variant="secondary"
          aria-label="次の週"
          icon={<ChevronRight className="size-4" aria-hidden="true" />}
          onClick={() => move(1)}
        />
        <p className="text-sm text-ink-sub">
          1週間を横向きA4で印刷します。色付きで印刷するには、印刷画面の「背景のグラフィック」をオンにしてください。
        </p>
        <Button
          className="ml-auto"
          icon={<Printer className="size-4" aria-hidden="true" />}
          disabled={!schedule.data || people.length === 0}
          onClick={() => window.print()}
        >
          {people.length > 0 ? `${people.length}人分を印刷する` : '印刷する'}
        </Button>
      </div>

      {schedule.data && (
        <PrintFilter
          sales={sales}
          who={who}
          ids={ids}
          prefs={prefs}
          printed={people.length}
          onChange={setFilter}
        />
      )}

      <header className="mb-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <h1 className="text-lg font-bold">
          {`営業スケジュール　${formatShortDate(monday)}〜${formatShortDate(friday)}`}
        </h1>
        <p className="text-[10px] text-ink-sub">
          {`印刷日 ${formatShortDate(todayJst())}・対象 ${target}・営業 ${people.length}人・時間帯 9:00–18:00`}
        </p>
      </header>

      {/* Legend: the same colours as the schedule screen */}
      <ul className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
        <li className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 bg-success/60" />
          空き
        </li>
        {(Object.keys(PRINT_STYLE) as (keyof typeof PRINT_STYLE)[]).map((kind) => (
          <li key={kind} className="flex items-center gap-1">
            <span className={cn('inline-block h-2.5 w-4', PRINT_STYLE[kind].bar)} />
            {PRINT_STYLE[kind].label}
          </li>
        ))}
        <li className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 bg-lunch" />
          昼休み
        </li>
        <li className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 bg-off ring-1 ring-line" />
          祝日・休日
        </li>
      </ul>

      {!schedule.data ? (
        <div className="flex justify-center py-16 text-ink-sub">
          <Spinner className="size-6" label={ja.common.loading} />
        </div>
      ) : people.length === 0 ? (
        <p className="border border-dashed border-line-strong py-12 text-center text-sm text-ink-sub">
          印刷する営業を選んでください。
        </p>
      ) : (
        <table className="w-full table-fixed border-collapse text-[10px] leading-snug">
          <thead>
            <tr>
              <th className="w-28 border border-ink-sub bg-column px-1.5 py-1 text-left align-bottom">
                担当（今週）
              </th>
              {days.map((date) => {
                const freePeople = people.filter((person) => freeOf(person.id, date) >= 60).length;
                return (
                  <th
                    key={date}
                    className={cn(
                      'border border-ink-sub px-1.5 py-1 text-left align-bottom',
                      holiday(date) ? 'bg-off' : 'bg-column',
                    )}
                  >
                    <span className="text-[11px]">{formatShortDate(date)}</span>
                    {holiday(date) ? (
                      <span className="ml-1 font-normal text-sunday">{holiday(date)}</span>
                    ) : (
                      <span className="ml-1.5 font-normal text-free-ink">
                        {`1時間以上空き ${freePeople}人`}
                      </span>
                    )}
                    <span className="mt-0.5 flex justify-between font-normal text-ink-sub">
                      <span>9</span>
                      <span>12</span>
                      <span>15</span>
                      <span>18</span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {people.map((person) => {
              const week = days.flatMap((date) =>
                holiday(date) ? [] : dayEvents(person.id, date),
              );
              const appointments = new Set(
                week
                  .filter((e) => e.kind === 'appointment' || e.kind === 'salesAppointment')
                  .map((e) => e.key),
              ).size;
              const weekFree = days.reduce((sum, date) => sum + freeOf(person.id, date), 0);
              return (
                <tr key={person.id} className="break-inside-avoid">
                  <th
                    scope="row"
                    className="border border-ink-sub px-1.5 py-1 text-left align-top font-normal"
                  >
                    <span className="block text-[11px] font-bold" data-no-translate>
                      {person.name}
                    </span>
                    <span className="mt-0.5 block">{`アポ ${appointments}件`}</span>
                    <span className="block font-bold text-free-ink">
                      {`空き ${hoursLabel(weekFree)}`}
                    </span>
                  </th>
                  {days.map((date) => {
                    if (holiday(date)) {
                      return <td key={date} className="border border-ink-sub bg-off" />;
                    }
                    const list = dayEvents(person.id, date);
                    const allDayOff = list.some(
                      (event) => event.allDay && event.kind === 'timeoff',
                    );
                    const free = freeRanges(list, date, { min: MIN_FREE });
                    return (
                      <td
                        key={date}
                        className={cn(
                          'h-16 border border-ink-sub px-1 py-1 align-top',
                          allDayOff && 'bg-column',
                        )}
                      >
                        <DayBar events={list} date={date} />
                        <p
                          className={cn(
                            'mb-0.5 font-bold',
                            allDayOff
                              ? 'text-ink-sub'
                              : free.length > 0
                                ? 'bg-free px-1 text-free-ink'
                                : 'bg-danger-soft px-1 text-danger',
                          )}
                        >
                          {allDayOff
                            ? '終日 休み'
                            : free.length > 0
                              ? `空き ${free.map(([s, e]) => `${short(s)}–${short(e)}`).join('・')}`
                              : '空きなし'}
                        </p>
                        <ul className="flex flex-col gap-0.5">
                          {list.map((event) => {
                            const kind = printKind(event);
                            if (!kind) return null;
                            const format = event.plan?.appointment
                              ? ja.format[event.plan.appointment.format]
                              : null;
                            return (
                              <li
                                key={event.key}
                                className={cn('px-1 py-px', PRINT_STYLE[kind].chip)}
                              >
                                <span className="mr-1 font-bold tabular-nums">
                                  {event.allDay
                                    ? '終日'
                                    : `${formatTime(event.startsAt)}–${formatTime(event.endsAt)}`}
                                </span>
                                {(kind === 'appointment' || kind === 'salesAppointment') && (
                                  <span className="mr-1 font-bold">
                                    {format ? `【アポ・${format}】` : '【アポ】'}
                                  </span>
                                )}
                                {kind === 'tentative' && (
                                  <span className="mr-1 font-bold">【仮】</span>
                                )}
                                <span data-no-translate>{event.title}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

type Who = 'all' | 'people' | 'area';
interface SalesPerson {
  id: string;
  name: string;
  prefectures: string[];
}

const splitParam = (value: string | null) => (value ?? '').split(',').filter(Boolean);

function toggle(list: string[], value: string): string {
  return (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]).join(
    ',',
  );
}

/** On screen only: choose whose week is printed — everyone, some people, or by area (11/11). */
function PrintFilter({
  sales,
  who,
  ids,
  prefs,
  printed,
  onChange,
}: {
  sales: SalesPerson[];
  who: Who;
  ids: string[];
  prefs: string[];
  printed: number;
  onChange: (patch: Record<string, string | null>) => void;
}) {
  const areas = PREFECTURE_NAMES.map((pref) => ({
    pref,
    reps: sales.filter((person) => person.prefectures.includes(pref)),
  })).filter((area) => area.reps.length > 0);
  const modes: { value: Who; label: string; icon?: ReactNode }[] = [
    { value: 'all', label: `営業全員（${sales.length}人）` },
    { value: 'people', label: '人を選ぶ', icon: <Users className="size-4" aria-hidden="true" /> },
    {
      value: 'area',
      label: 'エリアで選ぶ',
      icon: <MapPin className="size-4" aria-hidden="true" />,
    },
  ];
  const chip = (on: boolean) =>
    cn(
      'inline-flex h-9 cursor-pointer items-center gap-1.5 border px-3 text-sm transition-colors',
      on
        ? 'border-main bg-main-soft font-bold text-main'
        : 'border-line-strong bg-surface text-ink hover:border-main-line',
    );

  return (
    <section aria-label="印刷する営業" className="mb-5 border border-line bg-canvas print:hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <h2 className="text-sm font-bold">印刷する営業</h2>
        <div role="radiogroup" aria-label="印刷する営業" className="flex flex-wrap">
          {modes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              role="radio"
              aria-checked={who === mode.value}
              onClick={() => onChange({ who: mode.value === 'all' ? null : mode.value })}
              className={cn(
                '-ml-px inline-flex h-9 cursor-pointer items-center gap-1.5 border px-3.5 text-sm first:ml-0',
                who === mode.value
                  ? 'z-10 border-main bg-main text-white'
                  : 'border-line-strong bg-surface text-ink hover:bg-hover',
              )}
            >
              {mode.icon}
              {mode.label}
            </button>
          ))}
        </div>
        <p className="ml-auto text-sm">
          <span className="font-bold tabular-nums">{printed}</span>
          <span className="text-ink-sub">人を印刷</span>
        </p>
      </div>

      {who === 'people' && (
        <div className="flex flex-col gap-2 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {sales.map((person) => {
              const on = ids.includes(person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange({ ids: toggle(ids, person.id) || null })}
                  className={chip(on)}
                >
                  {on && <Check className="size-3.5" aria-hidden="true" />}
                  <span data-no-translate>{person.name}</span>
                  {person.prefectures.length > 0 && (
                    <span className="text-xs font-normal text-ink-sub">
                      {person.prefectures.slice(0, 2).join('・')}
                      {person.prefectures.length > 2 ? '…' : ''}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex gap-3 text-sm">
            <button
              type="button"
              className="cursor-pointer text-link hover:underline"
              onClick={() => onChange({ ids: sales.map((person) => person.id).join(',') })}
            >
              全員を選ぶ
            </button>
            <button
              type="button"
              className="cursor-pointer text-link hover:underline"
              onClick={() => onChange({ ids: null })}
            >
              選ぶのをやめる
            </button>
          </div>
        </div>
      )}

      {who === 'area' && (
        <div className="flex flex-col gap-2 px-4 py-3">
          {areas.length === 0 ? (
            <p className="text-sm text-ink-sub">
              営業担当表にエリアが登録されていません。管理 → 営業担当表で登録できます。
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {areas.map(({ pref, reps }) => {
                const on = prefs.includes(pref);
                return (
                  <button
                    key={pref}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange({ pref: toggle(prefs, pref) || null })}
                    className={chip(on)}
                  >
                    {on && <Check className="size-3.5" aria-hidden="true" />}
                    {pref}
                    <span className="text-xs font-normal text-ink-sub">{reps.length}人</span>
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-ink-sub">営業担当表（エリア）の担当営業を印刷します。</p>
        </div>
      )}
    </section>
  );
}
