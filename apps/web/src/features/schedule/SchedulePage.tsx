import { addDays, Permission } from '@telesales/shared';
import { CalendarOff, ChevronLeft, ChevronRight, Plus, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { paths } from '@/app/paths';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryState } from '@/components/ui/QueryState';
import { Select } from '@/components/ui/Select';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { formatDate, monthRange, startOfWeek, todayJst } from '@/lib/format';
import { ja } from '@/i18n/ja';
import { useSchedule } from './api';
import { DayView } from './DayView';
import { WeekView } from './WeekView';
import { EventDetailDialog } from './EventDetailDialog';
import { buildEvents, type CalendarEvent } from './events';
import { MonthView } from './MonthView';
import { PlanDialog } from './PlanDialog';
import { ScheduleLegend } from './ScheduleLegend';
import { TimeOffDialog } from './TimeOffDialog';

type View = 'day' | 'week' | 'month';

const VIEWS: { value: View; label: string }[] = [
  { value: 'day', label: '日' },
  { value: 'week', label: '週' },
  { value: 'month', label: '月' },
];

function rangeFor(view: View, date: string): { from: string; to: string } {
  if (view === 'day') return { from: date, to: date };
  if (view === 'week') {
    const start = startOfWeek(date);
    return { from: start, to: addDays(start, 6) };
  }
  const month = monthRange(date);
  return { from: startOfWeek(month.from), to: addDays(startOfWeek(month.to), 6) };
}

/** ② The single sales schedule: day / week / month, other reps too (spec §6). */
export function SchedulePage() {
  const user = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? todayJst();
  const view =
    (params.get('view') as View | null) ??
    (window.matchMedia?.('(max-width: 640px)').matches ? 'day' : 'week');
  const person = params.get('person') ?? '';
  const canPlans = usePermission(Permission.WriteSalesPlans);
  const isAdmin = usePermission(Permission.Administer);
  const canShifts = usePermission(Permission.WriteShifts);
  const canWritePlans = canPlans || isAdmin;
  const canTimeOff = canWritePlans || canShifts;
  const canSalesBook = usePermission(Permission.ManageSalesAppointments);

  const { from, to } = rangeFor(view, date);
  const schedule = useSchedule(from, to, []);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [planDialog, setPlanDialog] = useState<{
    event?: CalendarEvent;
    defaults?: { ownerId: string; date: string; time?: string };
  } | null>(null);
  const [timeOffDialog, setTimeOffDialog] = useState<{ userId: string; date: string } | null>(null);

  const update = (next: Partial<{ date: string; view: View; person: string }>) => {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value);
      else merged.delete(key);
    }
    setParams(merged, { replace: true });
  };
  const step = (direction: 1 | -1) => {
    if (view === 'day') update({ date: addDays(date, direction) });
    else if (view === 'week') update({ date: addDays(date, 7 * direction) });
    else {
      const [year, month] = date.split('-').map(Number) as [number, number];
      const target = new Date(Date.UTC(year, month - 1 + direction, 1));
      update({ date: target.toISOString().slice(0, 10) });
    }
  };

  const events = useMemo(() => (schedule.data ? buildEvents(schedule.data) : []), [schedule.data]);
  const allPeople = schedule.data?.people ?? [];
  const people = person ? allPeople.filter((p) => p.id === person) : allPeople;
  const monthPerson =
    person || (allPeople.some((p) => p.id === user.id) ? user.id : (allPeople[0]?.id ?? ''));
  const title =
    view === 'day'
      ? formatDate(date)
      : view === 'week'
        ? `${formatDate(from)} 〜`
        : `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月`;

  return (
    <>
      <PageHeader
        title={ja.module.schedule}
        actions={
          <>
            {canTimeOff && (
              <Button
                variant="secondary"
                icon={<CalendarOff className="size-4" aria-hidden="true" />}
                onClick={() => setTimeOffDialog({ userId: person || user.id, date })}
              >
                休みを入力
              </Button>
            )}
            {canSalesBook && (
              <Link
                to={`${paths.book}?source=SALES_BOOKED&repId=${user.id}&date=${date}`}
                className="inline-flex h-10 items-center gap-2 rounded-(--radius-control) border border-line bg-surface px-4 text-sm font-bold hover:bg-column"
              >
                <UserPlus className="size-4" aria-hidden="true" />
                自分で取ったアポを登録
              </Link>
            )}
            {canWritePlans && (
              <Button
                icon={<Plus className="size-4" aria-hidden="true" />}
                onClick={() => setPlanDialog({ defaults: { ownerId: person || user.id, date } })}
              >
                予定を追加
              </Button>
            )}
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            aria-label="前へ"
            onClick={() => step(-1)}
            icon={<ChevronLeft className="size-4" aria-hidden="true" />}
          />
          <Button variant="secondary" onClick={() => update({ date: todayJst() })}>
            今日
          </Button>
          <Button
            variant="secondary"
            aria-label="次へ"
            onClick={() => step(1)}
            icon={<ChevronRight className="size-4" aria-hidden="true" />}
          />
        </div>
        <span className="text-lg font-bold">{title}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="w-44">
            <Select
              aria-label="表示する人"
              value={person}
              placeholder="営業全員"
              options={allPeople.map((p) => ({ value: p.id, label: p.name }))}
              onChange={(e) => update({ person: e.target.value })}
            />
          </div>
          <div
            role="radiogroup"
            aria-label="表示"
            className="flex rounded-(--radius-control) border border-line bg-surface p-0.5"
          >
            {VIEWS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={view === option.value}
                onClick={() => update({ view: option.value })}
                className={cn(
                  'h-9 cursor-pointer rounded-[4px] px-4 text-sm font-bold',
                  view === option.value ? 'bg-main text-white' : 'text-ink-sub hover:bg-column',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mb-3">
        <ScheduleLegend />
      </div>

      <QueryState query={schedule}>
        {(data) =>
          view === 'week' ? (
            <WeekView
              start={from}
              people={people}
              events={events}
              holidays={data.holidays}
              onEvent={setSelected}
              onDay={(personId, day) =>
                update({ view: 'day', date: day, person: personId === person ? person : '' })
              }
            />
          ) : view === 'day' ? (
            <DayView
              date={date}
              people={people}
              events={events}
              holidays={data.holidays}
              onEvent={setSelected}
              onSlot={
                canWritePlans
                  ? (ownerId, time) => setPlanDialog({ defaults: { ownerId, date, time } })
                  : undefined
              }
            />
          ) : (
            <MonthView
              month={date}
              personId={monthPerson}
              events={events}
              holidays={data.holidays}
              onEvent={setSelected}
              onDay={(day) => update({ view: 'day', date: day, person: monthPerson })}
            />
          )
        }
      </QueryState>
      {view === 'month' && !person && (
        <p className="mt-2 text-xs text-ink-sub">
          月の表示は1人ずつです。「表示する人」で選べます。
        </p>
      )}

      <EventDetailDialog
        event={selected}
        onClose={() => setSelected(null)}
        onEdit={(event) => {
          setSelected(null);
          setPlanDialog({ event });
        }}
      />
      {planDialog && (
        <PlanDialog
          open
          plan={planDialog.event?.plan}
          defaults={planDialog.defaults}
          onClose={() => setPlanDialog(null)}
        />
      )}
      {timeOffDialog && (
        <TimeOffDialog open defaults={timeOffDialog} onClose={() => setTimeOffDialog(null)} />
      )}
    </>
  );
}
