import { dayOfWeek, type ShiftDto, ShiftKind, type TelemarketerDto } from '@telesales/shared';
import { CalendarPlus, ChevronLeft, ChevronRight, Plus, Users, Wand2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
import { BulkShiftDialog } from './BulkShiftDialog';
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

/**
 * Monthly shifts for the telemarketing team (spec §6 シフトの入力、当日の変更).
 * 11/13: own row first, today and past days easy to tell apart, filling your own shifts is the
 * main action (everyone's only for leads, behind its own button), several days at once.
 */
export function ShiftsPage() {
  const [params, setParams] = useSearchParams();
  const month = params.get('month') ?? todayJst().slice(0, 7);
  const query = useShiftMonth(month);
  const access = useTelemaAccess();
  const fill = useFillShifts();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [bulk, setBulk] = useState(false);
  const [confirmFill, setConfirmFill] = useState<'mine' | 'all' | null>(null);
  const today = todayJst();
  const go = (next: string) => setParams({ month: next }, { replace: true });

  const data = query.data;
  const me = data?.people.find((person) => person.user.id === access.userId) ?? null;
  // Telemarketers enter for themselves; leads and admins for anyone.
  const bulkPeople = data ? (access.manages ? data.people : me ? [me] : []) : [];
  const meReady = Boolean(me?.usualStart);

  // Bring today into view when the month has many days.
  const scroller = useRef<HTMLDivElement>(null);
  const todayCell = useRef<HTMLTableCellElement>(null);
  useEffect(() => {
    const box = scroller.current;
    const cell = todayCell.current;
    if (!box || !cell) return;
    // Today just after the sticky name column, with two past days before it and the rest of
    // the month after: what people come to fill in is today and the days ahead.
    const nameColumn = box.querySelector('th')?.offsetWidth ?? 0;
    box.scrollLeft = Math.max(0, cell.offsetLeft - nameColumn - cell.offsetWidth * 2);
  }, [month, data]);

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
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {me && (
              <Button
                icon={<Wand2 className="size-4" aria-hidden="true" />}
                disabled={!meReady}
                title={meReady ? undefined : 'テレマ情報で「いつもの勤務」を先に入れてください'}
                onClick={() => setConfirmFill('mine')}
              >
                自分のシフトを埋める
              </Button>
            )}
            {bulkPeople.length > 0 && (
              <Button
                variant="secondary"
                icon={<CalendarPlus className="size-4" aria-hidden="true" />}
                onClick={() => setBulk(true)}
              >
                まとめて入力
              </Button>
            )}
            {access.manages && (
              <Button
                variant="secondary"
                icon={<Users className="size-4" aria-hidden="true" />}
                onClick={() => setConfirmFill('all')}
              >
                全員分を埋める
              </Button>
            )}
          </div>
        )}
      </div>

      {me && !meReady && access.writesShifts && (
        <Alert tone="info">
          「自分のシフトを埋める」を使うには、テレマ情報で自分の「いつもの勤務」（曜日と時間）を入れてください。
        </Alert>
      )}
      {fill.isSuccess && (
        <Alert tone="success">
          {fill.data.created}日分を入れました。
          {fill.data.skipped > 0 && `（入力済みの${fill.data.skipped}日はそのままです）`}
        </Alert>
      )}
      {fill.isError && <Alert tone="error">{errorMessageOf(fill.error)}</Alert>}

      <Legend />

      <QueryState query={query}>
        {(view) => {
          if (view.people.length === 0)
            return (
              <Card>
                <EmptyState>
                  テレマの人がいません。管理 ＞ ユーザー・役割 で役割を付けてください。
                </EmptyState>
              </Card>
            );
          // Own row first, so nobody has to look for it.
          const people = [...view.people].sort(
            (a, b) => Number(b.user.id === access.userId) - Number(a.user.id === access.userId),
          );
          return (
            <Card flush>
              <div ref={scroller} className="overflow-x-auto">
                <table className="border-separate border-spacing-0 text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-20 w-52 min-w-52 border-r border-b border-head-line bg-head px-3 py-2 text-left text-sm">
                        名前
                      </th>
                      {view.days.map((day) => {
                        const weekday = dayOfWeek(day.date);
                        const isToday = day.date === today;
                        const past = day.date < today;
                        return (
                          <th
                            key={day.date}
                            ref={isToday ? todayCell : undefined}
                            title={day.holidayName ?? undefined}
                            aria-current={isToday ? 'date' : undefined}
                            className={cn(
                              'relative min-w-14 border-r border-b border-head-line px-1 pt-1 pb-1.5 text-center font-medium',
                              isToday
                                ? 'bg-main text-white'
                                : past
                                  ? 'bg-column text-ink-disabled'
                                  : !day.businessDay
                                    ? 'bg-off text-ink-sub'
                                    : 'bg-head text-ink',
                            )}
                          >
                            {isToday && (
                              <span className="mb-0.5 block text-[10px] leading-none font-bold">
                                今日
                              </span>
                            )}
                            <span className="block text-sm font-bold tabular-nums">
                              {Number(day.date.slice(8))}
                            </span>
                            <span
                              className={cn(
                                !isToday &&
                                  !past &&
                                  (weekday === 0 || day.holidayName) &&
                                  'text-sunday',
                                !isToday &&
                                  !past &&
                                  weekday === 6 &&
                                  !day.holidayName &&
                                  'text-saturday',
                              )}
                            >
                              {WEEKDAYS[weekday]}
                            </span>
                          </th>
                        );
                      })}
                      <th className="min-w-20 border-b border-head-line bg-head px-2 py-1 text-right font-medium">
                        合計
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((person) => {
                      const mine = person.user.id === access.userId;
                      const shifts = new Map(
                        view.shifts
                          .filter((shift) => shift.userId === person.user.id)
                          .map((shift) => [shift.date, shift]),
                      );
                      const total = [...shifts.values()].reduce(
                        (sum, shift) => sum + shift.workingMinutes,
                        0,
                      );
                      return (
                        <tr key={person.user.id}>
                          <th
                            className={cn(
                              'sticky left-0 z-10 border-r border-b border-line px-3 py-2 text-left text-sm font-medium',
                              mine
                                ? 'bg-main-soft shadow-[inset_3px_0_0_var(--color-main)]'
                                : 'bg-surface',
                            )}
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="truncate font-bold">{person.user.name}</span>
                              {mine && (
                                <span className="shrink-0 bg-main px-1.5 text-[10px] leading-4 font-bold text-white">
                                  あなた
                                </span>
                              )}
                            </span>
                            <span className="block text-xs font-normal text-ink-sub">
                              {person.usualStart
                                ? `${weekdaysLabel(person.usualWeekdays)} ${person.usualStart}〜${person.usualEnd}`
                                : 'いつもの勤務：未設定'}
                            </span>
                          </th>
                          {view.days.map((day) => {
                            const shift = shifts.get(day.date) ?? null;
                            const editable = access.canEditShift(person.user.id, day.date);
                            const isToday = day.date === today;
                            const past = day.date < today;
                            return (
                              <td
                                key={day.date}
                                className={cn(
                                  'border-r border-b border-line p-0.5 text-center',
                                  isToday && 'border-x-2 border-x-main bg-main-soft',
                                  !isToday && past && 'bg-column',
                                  !isToday && !past && !day.businessDay && 'bg-off',
                                  !isToday && !past && day.businessDay && mine && 'bg-main-soft/40',
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
                                    'group flex h-12 w-full flex-col items-center justify-center leading-tight tabular-nums transition-colors',
                                    editable
                                      ? 'cursor-pointer hover:outline-2 hover:outline-main hover:-outline-offset-2'
                                      : 'cursor-default',
                                    shift?.kind === ShiftKind.Off && 'bg-danger-soft text-danger',
                                    shift?.kind === ShiftKind.Work && 'bg-calls-soft text-calls',
                                    shift && past && !isToday && 'opacity-55',
                                    !shift &&
                                      editable &&
                                      !past &&
                                      day.businessDay &&
                                      'border border-dashed border-line-strong text-ink-disabled hover:border-main hover:bg-main-soft hover:text-main',
                                    shift?.note && 'underline decoration-dotted',
                                  )}
                                >
                                  {shift?.kind === ShiftKind.Off && (
                                    <span className="font-bold">休</span>
                                  )}
                                  {shift?.kind === ShiftKind.Work && (
                                    <>
                                      <span>{shift.startTime}</span>
                                      <span>{shift.endTime}</span>
                                    </>
                                  )}
                                  {!shift && editable && !past && day.businessDay && (
                                    <Plus className="size-4" aria-hidden="true" />
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
          );
        }}
      </QueryState>
      <p className="text-sm text-ink-sub">
        「＋」のマスを押すと1日ずつ入力できます。離れた日をまとめて入れるときは「まとめて入力」。自分のシフトはいつでも、ほかの人の分は今日から先だけ（連絡を受けた休み・遅刻・早退）。リーダーと管理者は全員の分を直せます。
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
      {bulk && data && (
        <BulkShiftDialog
          onClose={() => setBulk(false)}
          month={month}
          days={data.days}
          people={bulkPeople}
          initialPersonId={me?.user.id ?? bulkPeople[0]?.user.id ?? ''}
          shifts={data.shifts}
          canEdit={access.canEditShift}
        />
      )}
      <Dialog
        open={confirmFill !== null}
        onClose={() => setConfirmFill(null)}
        title={confirmFill === 'all' ? '全員のシフトを埋めますか？' : '自分のシフトを埋めますか？'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmFill(null)}>
              キャンセル
            </Button>
            <Button
              loading={fill.isPending}
              onClick={() =>
                fill.mutate(
                  confirmFill === 'mine' && me ? { month, userIds: [me.user.id] } : { month },
                  { onSettled: () => setConfirmFill(null) },
                )
              }
            >
              {confirmFill === 'all' ? `全員（${data?.people.length ?? 0}人）分を埋める` : '埋める'}
            </Button>
          </>
        }
      >
        {confirmFill === 'all' ? (
          <div className="flex flex-col gap-2">
            <p>
              {month.replace('-', '年')}
              月の今日から先の営業日を、次の全員の「いつもの勤務」で埋めます。入力済みの日は変えません。
            </p>
            <p className="text-sm text-ink-sub">
              {data?.people.map((person) => person.user.name).join('、')}
            </p>
          </div>
        ) : (
          <p>
            {month.replace('-', '年')}月の今日から先の営業日を、あなたの「いつもの勤務」
            {me?.usualStart &&
              `（${weekdaysLabel(me.usualWeekdays)} ${me.usualStart}〜${me.usualEnd}）`}
            で埋めます。ほかの人のシフトは変えません。入力済みの日もそのままです。
          </p>
        )}
      </Dialog>
    </div>
  );
}

function Legend() {
  const item = 'inline-flex items-center gap-1.5';
  const swatch = 'inline-block size-3.5';
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-sub">
      <span className={item}>
        <span className={cn(swatch, 'border border-calls bg-calls-soft')} />
        出勤
      </span>
      <span className={item}>
        <span className={cn(swatch, 'border border-danger bg-danger-soft')} />
        休み
      </span>
      <span className={item}>
        <span className={cn(swatch, 'border border-dashed border-line-strong')} />
        未入力（押すと入力）
      </span>
      <span className={item}>
        <span className={cn(swatch, 'bg-main')} />
        今日
      </span>
      <span className={item}>
        <span className={cn(swatch, 'border border-line-strong bg-column')} />
        過ぎた日
      </span>
      <span className={item}>
        <span className={cn(swatch, 'bg-off')} />
        土日祝・会社の休日
      </span>
    </div>
  );
}
