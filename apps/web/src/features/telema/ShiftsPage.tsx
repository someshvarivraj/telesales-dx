import { dayOfWeek, type ShiftDto, ShiftKind, type TelemarketerDto } from '@telesales/shared';
import { ChevronLeft, ChevronRight, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { todayJst } from '@/lib/format';
import { useFillShifts, useShiftMonth } from './api';
import { ShiftDialog } from './ShiftDialog';
import { formatMinutes, useTelemaAccess, weekdaysLabel } from './telemaAccess';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number) as [number, number];
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

interface Editing {
  person: TelemarketerDto;
  date: string;
  shift: ShiftDto | null;
}

/** Monthly shifts for the telemarketing team (spec §6 シフトの入力、当日の変更). */
export function ShiftsPage() {
  const [params, setParams] = useSearchParams();
  const month = params.get('month') ?? todayJst().slice(0, 7);
  const query = useShiftMonth(month);
  const access = useTelemaAccess();
  const fill = useFillShifts();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirmFill, setConfirmFill] = useState(false);
  const today = todayJst();
  const go = (next: string) => setParams({ month: next }, { replace: true });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          aria-label="前の月"
          icon={<ChevronLeft className="size-4" aria-hidden="true" />}
          onClick={() => go(shiftMonth(month, -1))}
        />
        <h2 className="min-w-32 text-center text-lg font-bold tabular-nums">
          {month.replace('-', '年')}月
        </h2>
        <Button
          variant="secondary"
          aria-label="次の月"
          icon={<ChevronRight className="size-4" aria-hidden="true" />}
          onClick={() => go(shiftMonth(month, 1))}
        />
        <Button variant="text" onClick={() => go(today.slice(0, 7))}>
          今月
        </Button>
        {access.writesShifts && (
          <Button
            className="ml-auto"
            variant="secondary"
            icon={<Wand2 className="size-4" aria-hidden="true" />}
            onClick={() => setConfirmFill(true)}
          >
            いつもの勤務で埋める
          </Button>
        )}
      </div>
      {fill.isSuccess && (
        <Alert tone="success">
          {fill.data.created}日分を入れました。
          {fill.data.skipped > 0 && `（入力済みの${fill.data.skipped}日はそのままです）`}
        </Alert>
      )}
      {fill.isError && <Alert tone="error">{errorMessageOf(fill.error)}</Alert>}

      <QueryState query={query}>
        {(data) =>
          data.people.length === 0 ? (
            <Card>
              <EmptyState>
                テレマの人がいません。管理 ＞ ユーザー・役割 で役割を付けてください。
              </EmptyState>
            </Card>
          ) : (
            <Card flush>
              <div className="overflow-x-auto">
                <table className="border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 min-w-28 border-b border-r border-line bg-surface px-3 py-2 text-left text-sm">
                        名前
                      </th>
                      {data.days.map((day) => {
                        const weekday = dayOfWeek(day.date);
                        return (
                          <th
                            key={day.date}
                            title={day.holidayName ?? undefined}
                            className={cn(
                              'min-w-14 border-b border-r border-line px-1 py-1 text-center font-medium',
                              !day.businessDay && 'bg-column text-ink-sub',
                              day.date === today && 'bg-main-soft text-main',
                            )}
                          >
                            <span className="block tabular-nums">{Number(day.date.slice(8))}</span>
                            <span
                              className={cn(
                                weekday === 0 || day.holidayName ? 'text-danger' : '',
                                weekday === 6 && !day.holidayName ? 'text-schedule' : '',
                              )}
                            >
                              {WEEKDAYS[weekday]}
                            </span>
                          </th>
                        );
                      })}
                      <th className="min-w-20 border-b border-line px-2 py-1 text-right font-medium">
                        合計
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.people.map((person) => {
                      const shifts = new Map(
                        data.shifts
                          .filter((shift) => shift.userId === person.user.id)
                          .map((shift) => [shift.date, shift]),
                      );
                      const total = [...shifts.values()].reduce(
                        (sum, shift) => sum + shift.workingMinutes,
                        0,
                      );
                      return (
                        <tr key={person.user.id}>
                          <th className="sticky left-0 z-10 border-b border-r border-line bg-surface px-3 py-2 text-left text-sm font-medium">
                            {person.user.name}
                            <span className="block text-xs font-normal text-ink-sub">
                              {person.usualStart
                                ? `${weekdaysLabel(person.usualWeekdays)} ${person.usualStart}〜${person.usualEnd}`
                                : 'いつもの勤務：未設定'}
                            </span>
                          </th>
                          {data.days.map((day) => {
                            const shift = shifts.get(day.date) ?? null;
                            const editable = access.canEditShift(person.user.id, day.date);
                            return (
                              <td
                                key={day.date}
                                className={cn(
                                  'border-b border-r border-line p-0 text-center',
                                  !day.businessDay && 'bg-column',
                                )}
                              >
                                <button
                                  type="button"
                                  disabled={!editable}
                                  onClick={() => setEditing({ person, date: day.date, shift })}
                                  title={shift?.note ?? undefined}
                                  aria-label={`${person.user.name} ${day.date} ${
                                    shift
                                      ? shift.kind === ShiftKind.Off
                                        ? '休み'
                                        : `${shift.startTime}〜${shift.endTime}`
                                      : '未入力'
                                  }`}
                                  className={cn(
                                    'flex h-12 w-full flex-col items-center justify-center leading-tight tabular-nums',
                                    editable && 'hover:bg-main-soft',
                                    shift?.kind === ShiftKind.Off && 'bg-danger-soft text-danger',
                                    shift?.kind === ShiftKind.Work && 'bg-calls-soft text-calls',
                                    shift?.note && 'underline decoration-dotted',
                                  )}
                                >
                                  {shift?.kind === ShiftKind.Off && '休'}
                                  {shift?.kind === ShiftKind.Work && (
                                    <>
                                      <span>{shift.startTime}</span>
                                      <span>{shift.endTime}</span>
                                    </>
                                  )}
                                </button>
                              </td>
                            );
                          })}
                          <td className="border-b border-line px-2 text-right text-sm tabular-nums">
                            {formatMinutes(total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        }
      </QueryState>
      <p className="text-sm text-ink-sub">
        マスを押すと入力できます。自分のシフトはいつでも、ほかの人の分は今日から先だけ（連絡を受けた休み・遅刻・早退）。リーダーと管理者は全員の分を直せます。
      </p>

      {editing && (
        <ShiftDialog
          key={`${editing.person.user.id}:${editing.date}`}
          open
          onClose={() => setEditing(null)}
          person={editing.person.user}
          date={editing.date}
          shift={editing.shift}
          usual={{
            start: editing.person.usualStart,
            end: editing.person.usualEnd,
            breakMinutes: editing.person.usualBreakMinutes,
          }}
        />
      )}
      <Dialog
        open={confirmFill}
        onClose={() => setConfirmFill(false)}
        title="いつもの勤務で埋めますか？"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmFill(false)}>
              キャンセル
            </Button>
            <Button
              loading={fill.isPending}
              onClick={() => fill.mutate({ month }, { onSettled: () => setConfirmFill(false) })}
            >
              埋める
            </Button>
          </>
        }
      >
        <p>
          {month.replace('-', '年')}月の、今日から先の営業日を
          {access.manages ? '全員の' : 'あなたの'}
          「いつもの勤務」（テレマ情報）で埋めます。入力済みの日は変えません。
        </p>
      </Dialog>
    </div>
  );
}
