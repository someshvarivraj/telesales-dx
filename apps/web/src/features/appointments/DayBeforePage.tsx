import { DayBeforeResult, jstMinutesOfDay, Permission } from '@telesales/shared';
import { CalendarClock, CircleCheck, PhoneOff } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { paths } from '@/app/paths';
import { StickyExtra } from '@/components/ui/StickyTop';
import { DatePicker } from '@/components/ui/DatePicker';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Checkbox } from '@/components/ui/Checkbox';
import { cn } from '@/components/ui/cn';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDate, formatRange, todayJst } from '@/lib/format';
import { ja } from '@/i18n/ja';
import { useDayBeforeCheck, useDayBeforeList } from './api';
import { DayBeforeBadge, FormatBadge } from './AppointmentBadges';

/**
 * Day-before checks (spec §7): telemarketing appointments of the next business day.
 * Checks done after 12:00 are sent to the rep one by one (N14).
 */
export function DayBeforePage() {
  const [params] = useSearchParams();
  const [date, setDate] = useState(todayJst());
  // Confirmed allocation (priority 2); the home tile links here with ?mine=1.
  const [onlyMine, setOnlyMine] = useState(params.get('mine') === '1');
  const { id: userId } = useCurrentUser();
  const list = useDayBeforeList(date);
  const check = useDayBeforeCheck();
  const canCheck = usePermission(Permission.WriteDayBeforeChecks);
  const afterNoon = date === todayJst() && jstMinutesOfDay(new Date()) >= 12 * 60;

  return (
    <div className="flex flex-col gap-4">
      {/* Stays in the section's fixed top while the list scrolls (11/17). */}
      <StickyExtra>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-bold">
            確認する日
            <DatePicker
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="w-48"
            />
          </label>
          {list.data && (
            <p className="pb-2 text-sm text-ink-sub">
              対象：{list.data.dates.map(formatDate).join('・')} のアポ（テレマが取ったアポのみ）
            </p>
          )}
          {list.data?.allocated && (
            <Checkbox
              className="pb-2 sm:ml-auto"
              label="自分の担当だけ"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
            />
          )}
        </div>
      </StickyExtra>
      {afterNoon && (
        <Alert tone="info">
          12時を過ぎました。翌日のアポのメール（N4）は送信済みです。これから確認したアポは「営業へ送る」で1件ずつ送ってください。
        </Alert>
      )}
      {check.isError && <Alert tone="error">{errorMessageOf(check.error)}</Alert>}
      <QueryState query={list}>
        {(data) => {
          const items = data.items.filter(
            (item) => !onlyMine || !data.allocated || item.assignee?.id === userId,
          );
          return items.length === 0 ? (
            <Card>
              <EmptyState mood="booked">確認するアポはありません。</EmptyState>
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <li key={item.id}>
                  <Card>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={paths.appointment(item.id)}
                            className="font-bold text-link hover:underline"
                          >
                            {item.company.name}
                          </Link>
                          <FormatBadge format={item.format} />
                          <DayBeforeBadge result={item.dayBeforeResult} />
                        </div>
                        <p className="mt-1 text-sm text-ink-sub">
                          {formatRange(item.startsAt, item.endsAt)}・担当 {item.salesRep.name}・取得{' '}
                          {item.bookedBy.name}
                          {item.assignee && `・確認する人 ${item.assignee.name}`}
                        </p>
                      </div>
                      {canCheck && (
                        <div className="flex flex-wrap items-center gap-2">
                          <DayBeforeChoice
                            result={item.dayBeforeResult}
                            savingResult={
                              check.isPending && check.variables.id === item.id
                                ? check.variables.request.result
                                : null
                            }
                            onPick={(result) => check.mutate({ id: item.id, request: { result } })}
                          />
                          {item.dayBeforeResult && afterNoon && (
                            <Link
                              to={paths.appointmentMail(item.id, 'dayBefore')}
                              className="inline-flex h-10 items-center rounded-(--radius-control) border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-hover"
                            >
                              営業へ送る
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          );
        }}
      </QueryState>
    </div>
  );
}

const DONE: Record<DayBeforeResult, { icon: typeof CircleCheck; tone: string }> = {
  [DayBeforeResult.Confirmed]: {
    icon: CircleCheck,
    tone: 'border-success/40 bg-success-soft text-success',
  },
  [DayBeforeResult.NotReached]: {
    icon: PhoneOff,
    tone: 'border-warning/50 bg-warning-soft text-warning-ink',
  },
  [DayBeforeResult.Changed]: {
    icon: CalendarClock,
    tone: 'border-schedule/40 bg-schedule-soft text-schedule',
  },
};

/**
 * The day-before result (11/17: a highlighted button after 確認済み looked as if it still had to
 * be pressed). Before a result: the three choices as buttons. After: the result as a clear
 * status (icon, colour, 記録済み), with a small 「結果を変える」 to show the choices again.
 */
export function DayBeforeChoice({
  result,
  savingResult,
  onPick,
}: {
  result: DayBeforeResult | null;
  savingResult: DayBeforeResult | null;
  onPick: (result: DayBeforeResult) => void;
}) {
  const [changing, setChanging] = useState(false);
  if (result && !changing && !savingResult) {
    const done = DONE[result];
    const Icon = done.icon;
    return (
      <>
        <span
          role="status"
          className={cn(
            'inline-flex h-10 items-center gap-2 border px-4 text-sm font-bold',
            done.tone,
          )}
        >
          <Icon aria-hidden="true" className="size-4.5" />
          {ja.dayBefore[result]}
          <span className="text-xs font-normal opacity-80">記録済み</span>
        </span>
        <Button variant="text" size="sm" onClick={() => setChanging(true)}>
          結果を変える
        </Button>
      </>
    );
  }
  return (
    <>
      {Object.values(DayBeforeResult).map((choice) => (
        <Button
          key={choice}
          variant="secondary"
          loading={savingResult === choice}
          aria-pressed={result === choice}
          className={cn(result === choice && 'border-main text-main')}
          onClick={() => {
            onPick(choice);
            setChanging(false);
          }}
        >
          {ja.dayBefore[choice]}
        </Button>
      ))}
      {changing && (
        <Button variant="text" size="sm" onClick={() => setChanging(false)}>
          やめる
        </Button>
      )}
    </>
  );
}
