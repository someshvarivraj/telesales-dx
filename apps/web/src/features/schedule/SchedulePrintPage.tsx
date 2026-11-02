import { addDays } from '@telesales/shared';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Spinner } from '@/components/ui/Spinner';
import { formatShortDate, formatTime, startOfWeek, todayJst } from '@/lib/format';
import { ja } from '@/i18n/ja';
import { useSchedule } from './api';
import { buildEvents, type CalendarEvent, eventsOn } from './events';

const WEEKDAYS = 5;

function eventLine(event: CalendarEvent): { time: string; text: string } {
  const time = event.allDay ? '終日' : `${formatTime(event.startsAt)}–${formatTime(event.endsAt)}`;
  const format = event.plan?.appointment ? `（${ja.format[event.plan.appointment.format]}）` : '';
  const prefix =
    event.kind === 'appointment' ? '【アポ】' : event.kind === 'tentative' ? '【仮】' : '';
  return { time, text: `${prefix}${event.title}${format}` };
}

/**
 * 週間予定の印刷 (11/2): the sales reps' week, Monday to Friday, one row per rep, on one
 * landscape A4 page. Opened from the schedule with the people shown there.
 */
export function SchedulePrintPage() {
  const [params, setParams] = useSearchParams();
  const monday = startOfWeek(params.get('date') ?? todayJst());
  const friday = addDays(monday, WEEKDAYS - 1);
  const chosen = (params.get('people') ?? '').split(',').filter(Boolean);
  const schedule = useSchedule(monday, addDays(monday, 6), []);
  const events = useMemo(() => (schedule.data ? buildEvents(schedule.data) : []), [schedule.data]);
  const days = Array.from({ length: WEEKDAYS }, (_, index) => addDays(monday, index));
  const people = (schedule.data?.people ?? []).filter((person) =>
    chosen.length > 0 ? chosen.includes(person.id) : person.isSales,
  );
  const holiday = (date: string) => schedule.data?.holidays.find((day) => day.date === date)?.name;
  const move = (weeks: number) => {
    const next = new URLSearchParams(params);
    next.set('date', addDays(monday, weeks * 7));
    setParams(next, { replace: true });
  };

  return (
    <div className="min-h-dvh bg-surface p-6 text-ink print:p-0">
      <style>{'@page { size: A4 landscape; margin: 8mm; }'}</style>
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
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
          横向きA4・1枚に収まるように印刷します。表示する人はスケジュール画面で選んだ人です。
        </p>
        <Button
          className="ml-auto"
          icon={<Printer className="size-4" aria-hidden="true" />}
          disabled={!schedule.data}
          onClick={() => window.print()}
        >
          印刷する
        </Button>
      </div>

      <header className="mb-2 flex items-baseline justify-between gap-4">
        <h1 className="text-lg font-bold">
          {`営業スケジュール　${formatShortDate(monday)}〜${formatShortDate(friday)}`}
        </h1>
        <p className="text-xs text-ink-sub">{`印刷日 ${formatShortDate(todayJst())}`}</p>
      </header>

      {!schedule.data ? (
        <div className="flex justify-center py-16 text-ink-sub">
          <Spinner className="size-6" label={ja.common.loading} />
        </div>
      ) : (
        <table className="w-full table-fixed border-collapse text-[11px] leading-snug">
          <thead>
            <tr>
              <th className="w-24 border border-ink-sub bg-column px-1.5 py-1 text-left">担当</th>
              {days.map((date) => (
                <th
                  key={date}
                  className={cn(
                    'border border-ink-sub px-1.5 py-1 text-left',
                    holiday(date) ? 'bg-off' : 'bg-column',
                  )}
                >
                  {formatShortDate(date)}
                  {holiday(date) && (
                    <span className="ml-1 font-normal text-sunday">{holiday(date)}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id} className="break-inside-avoid">
                <th
                  scope="row"
                  className="border border-ink-sub px-1.5 py-1 text-left align-top font-bold"
                  data-no-translate
                >
                  {person.name}
                </th>
                {days.map((date) => {
                  const dayEvents = eventsOn(events, date, person.id).filter(
                    (event) => event.kind !== 'lock',
                  );
                  return (
                    <td
                      key={date}
                      className={cn(
                        'h-14 border border-ink-sub px-1.5 py-1 align-top',
                        holiday(date) && 'bg-off',
                      )}
                    >
                      <ul className="flex flex-col gap-0.5">
                        {dayEvents.map((event) => {
                          const line = eventLine(event);
                          return (
                            <li
                              key={event.key}
                              className={cn(event.kind === 'appointment' && 'font-bold')}
                            >
                              <span className="mr-1 tabular-nums">{line.time}</span>
                              <span data-no-translate>{line.text}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
