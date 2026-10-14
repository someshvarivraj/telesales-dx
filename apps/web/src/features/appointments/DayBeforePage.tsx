import { DayBeforeResult, jstMinutesOfDay, Permission } from '@telesales/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { TextInput } from '@/components/ui/TextInput';
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
  const [date, setDate] = useState(todayJst());
  const list = useDayBeforeList(date);
  const check = useDayBeforeCheck();
  const canCheck = usePermission(Permission.WriteDayBeforeChecks);
  const afterNoon = date === todayJst() && jstMinutesOfDay(new Date()) >= 12 * 60;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-bold">
          確認する日
          <TextInput
            type="date"
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
      </div>
      {afterNoon && (
        <Alert tone="info">
          12時を過ぎました。翌日のアポのメール（N4）は送信済みです。これから確認したアポは「営業へ送る」で1件ずつ送ってください。
        </Alert>
      )}
      {check.isError && <Alert tone="error">{errorMessageOf(check.error)}</Alert>}
      <QueryState query={list}>
        {(data) =>
          data.items.length === 0 ? (
            <Card>
              <EmptyState>確認するアポはありません。</EmptyState>
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.items.map((item) => (
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
                        </p>
                      </div>
                      {canCheck && (
                        <div className="flex flex-wrap gap-2">
                          {Object.values(DayBeforeResult).map((result) => (
                            <Button
                              key={result}
                              variant={item.dayBeforeResult === result ? 'primary' : 'secondary'}
                              loading={
                                check.isPending &&
                                check.variables.id === item.id &&
                                check.variables.request.result === result
                              }
                              onClick={() => check.mutate({ id: item.id, request: { result } })}
                            >
                              {ja.dayBefore[result]}
                            </Button>
                          ))}
                          {item.dayBeforeResult && afterNoon && (
                            <Link
                              to={paths.appointmentMail(item.id, 'dayBefore')}
                              className="inline-flex h-10 items-center rounded-(--radius-control) border border-main px-4 text-sm font-bold text-main hover:bg-main-soft"
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
          )
        }
      </QueryState>
    </div>
  );
}
