import { ClipboardCheck, PhoneCall } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { DatePicker } from '@/components/ui/DatePicker';
import { Alert } from '@/components/ui/Alert';
import { LinkButton } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Table, Td, Th } from '@/components/ui/Table';
import { useHomeSummary } from '@/features/dashboard/api';
import { formatDate, todayJst } from '@/lib/format';
import { useMyAssignments, useStaff } from './api';
import { formatMinutes, useTelemaAccess } from './telemaAccess';

/** Today: my confirmed assignments, then who is working (spec §6 当日の稼働一覧). */
export function TodayPage() {
  const [date, setDate] = useState(todayJst());
  const { writesShifts, manages } = useTelemaAccess();
  const staff = useStaff(date);
  const summary = useHomeSummary();

  return (
    <div className="flex flex-col gap-5">
      {writesShifts && <MyAssignments />}
      {manages && summary.data?.allocationToConfirm && (
        <Alert
          tone="warning"
          action={
            <LinkButton variant="primary" size="sm" to={paths.telemaAllocation}>
              割り振りを確かめて確定する
            </LinkButton>
          }
        >
          今日の割り振りがまだ確定していません。
        </Alert>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-bold">
          日付
          <DatePicker
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="w-48"
          />
        </label>
      </div>

      <QueryState query={staff}>
        {(data) => (
          <>
            {!data.businessDay && <Alert tone="info">{formatDate(date)} は休日です。</Alert>}
            <Card title={`出勤（${data.working.length}人）`} flush>
              {data.working.length === 0 ? (
                <EmptyState mood="think">出勤の人はいません。</EmptyState>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>名前</Th>
                      <Th>時間</Th>
                      <Th>休憩</Th>
                      <Th>稼働</Th>
                      <Th>割り振り</Th>
                      <Th>メモ</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.working.map((row) => (
                      <tr key={row.user.id}>
                        <Td className="font-medium">{row.user.name}</Td>
                        <Td className="tabular-nums">
                          {row.startTime}〜{row.endTime}
                        </Td>
                        <Td className="tabular-nums">{row.breakMinutes}分</Td>
                        <Td className="tabular-nums">{formatMinutes(row.workingMinutes)}</Td>
                        <Td>
                          {row.isAllocationTarget ? (
                            <Badge tone="calls">対象</Badge>
                          ) : (
                            <Badge tone="outline">対象外</Badge>
                          )}
                        </Td>
                        <Td className="text-ink-sub">{row.note}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
            <div className="grid gap-5 md:grid-cols-2">
              <Card title={`休み（${data.off.length}人）`}>
                {data.off.length === 0 ? (
                  <p className="text-sm text-ink-sub">いません。</p>
                ) : (
                  <ul className="flex flex-col gap-1 text-sm">
                    {data.off.map((row) => (
                      <li key={row.user.id}>
                        <span className="font-medium">{row.user.name}</span>
                        {row.note && <span className="ml-2 text-ink-sub">{row.note}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title={`シフト未入力（${data.missing.length}人）`}>
                {data.missing.length === 0 ? (
                  <p className="text-sm text-ink-sub">全員入っています。</p>
                ) : (
                  <>
                    <p className="text-sm">{data.missing.map((user) => user.name).join('、')}</p>
                    <LinkButton
                      size="sm"
                      to={`${paths.telemaShifts}?month=${date.slice(0, 7)}`}
                      className="mt-3"
                    >
                      シフトを入れる
                    </LinkButton>
                  </>
                )}
              </Card>
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}

function MyAssignments() {
  const mine = useMyAssignments();
  return (
    <Card title="あなたの今日の担当">
      <QueryState query={mine}>
        {(data) =>
          !data.confirmed ? (
            <p className="text-sm text-ink-sub">
              まだ割り振りが確定していません。リーダーが確定すると、ここに出ます。
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <AssignmentTile
                to={`${paths.calls}?mine=1`}
                icon={<PhoneCall className="size-6 text-calls" aria-hidden="true" />}
                label="架電"
                count={data.calls}
              />
              <AssignmentTile
                to={`${paths.dayBefore}?mine=1`}
                icon={<ClipboardCheck className="size-6 text-calls" aria-hidden="true" />}
                label="前日確認"
                count={data.dayBefore}
              />
            </div>
          )
        }
      </QueryState>
    </Card>
  );
}

function AssignmentTile(props: { to: string; icon: ReactNode; label: string; count: number }) {
  return (
    <Link
      to={props.to}
      className="flex items-center gap-3 border border-line p-4 transition-colors hover:border-main-line hover:bg-main-soft/40"
    >
      {props.icon}
      <span className="flex-1 text-sm font-medium">{props.label}</span>
      <span className="text-2xl font-bold tabular-nums">{props.count}</span>
      <span className="text-sm text-ink-sub">件</span>
    </Link>
  );
}
