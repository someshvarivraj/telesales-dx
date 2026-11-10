import {
  addDays,
  appointmentRate,
  type CallResultsCell,
  type CallResultsResponse,
  dayOfWeek,
} from '@telesales/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Segmented } from '@/components/ui/Segmented';
import { todayJst } from '@/lib/format';
import { useCallResults } from './api';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
type Span = 'week' | 'month';

/** Monday of the week the date is in. */
function weekStart(date: string): string {
  return addDays(date, -((dayOfWeek(date) + 6) % 7));
}

function monthEnd(month: string): string {
  const [y = 0, m = 1] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function shiftMonth(month: string, by: number): string {
  const [y = 0, m = 1] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}

function rangeOf(span: Span, anchor: string): { from: string; to: string } {
  if (span === 'month') {
    const month = anchor.slice(0, 7);
    return { from: `${month}-01`, to: monthEnd(month) };
  }
  const from = weekStart(anchor);
  return { from, to: addDays(from, 6) };
}

/** 0.25 → 25.0% */
function formatRate(rate: number | null): string {
  return rate === null ? '―' : `${(rate * 100).toFixed(1)}%`;
}

function shortDate(date: string): string {
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`;
}

/**
 * 架電実績 (answer 11/10 No.3): per telemarketer per day, the calls A–D, the appointments A
 * and the appointment rate A ÷ (A+B+C+D), the figure that goes in the daily report.
 */
export function CallResultsPage() {
  const [params, setParams] = useSearchParams();
  const today = todayJst();
  const span: Span = params.get('span') === 'month' ? 'month' : 'week';
  const anchor = params.get('date') ?? today;
  const { from, to } = rangeOf(span, anchor);
  const query = useCallResults(from, to);
  const go = (next: { span?: Span; date?: string }) =>
    setParams({ span: next.span ?? span, date: next.date ?? anchor }, { replace: true });
  const step = (by: number) =>
    go({
      date: span === 'month' ? `${shiftMonth(from.slice(0, 7), by)}-01` : addDays(from, 7 * by),
    });
  const title =
    span === 'month'
      ? `${from.slice(0, 4)}年${Number(from.slice(5, 7))}月`
      : `${shortDate(from)}〜${shortDate(to)}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          aria-label={span === 'month' ? '前の月' : '前の週'}
          icon={<ChevronLeft className="size-4" aria-hidden="true" />}
          onClick={() => step(-1)}
        />
        <h2 className="min-w-40 text-center text-lg font-bold tabular-nums">{title}</h2>
        <Button
          variant="secondary"
          aria-label={span === 'month' ? '次の月' : '次の週'}
          icon={<ChevronRight className="size-4" aria-hidden="true" />}
          onClick={() => step(1)}
        />
        <Button variant="text" onClick={() => go({ date: today })}>
          {span === 'month' ? '今月' : '今週'}
        </Button>
        <Segmented
          className="ml-auto"
          aria-label="期間"
          value={span}
          onChange={(next) => go({ span: next })}
          options={[
            { value: 'week', label: '週' },
            { value: 'month', label: '月' },
          ]}
        />
      </div>

      <QueryState query={query}>{(data) => <Results data={data} today={today} />}</QueryState>

      <p className="text-xs text-ink-sub">
        アポ率 ＝ A の数 ÷（A＋B＋C＋D の数）。E
        は数えません。同じ会社に1日に2回かけたときは2件です。
      </p>
    </div>
  );
}

function Results({ data, today }: { data: CallResultsResponse; today: string }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="架電数（A〜D）" value={data.calls.toLocaleString()} />
        <Stat label="アポ（A）" value={data.appointments.toLocaleString()} />
        <Stat label="アポ率" value={formatRate(appointmentRate(data.appointments, data.calls))} />
      </div>

      {data.rows.length === 0 ? (
        <Card>
          <EmptyState>この期間の架電はありません。</EmptyState>
        </Card>
      ) : (
        <Card flush>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-28 border-r border-b border-line bg-surface px-3 py-2 text-left">
                    テレマ
                  </th>
                  {data.dates.map((date) => {
                    const weekday = dayOfWeek(date);
                    return (
                      <th
                        key={date}
                        className={cn(
                          'min-w-24 border-r border-b border-line px-2 py-1.5 text-center text-xs font-medium',
                          (weekday === 0 || weekday === 6) && 'bg-off text-ink-sub',
                          date === today && 'bg-main-soft text-ink',
                        )}
                      >
                        <span className="tabular-nums">
                          {Number(date.slice(5, 7))}/{Number(date.slice(8))}
                        </span>
                        <span
                          className={cn(
                            'ml-1',
                            weekday === 0 && 'text-danger',
                            weekday === 6 && 'text-schedule',
                          )}
                        >
                          {WEEKDAYS[weekday]}
                        </span>
                      </th>
                    );
                  })}
                  <th className="min-w-28 border-b border-l sm:sticky sm:right-0 sm:z-10 border-line bg-column px-2 py-1.5 text-center text-xs font-bold">
                    合計
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.telemarketer.id}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-r border-b border-line bg-surface px-3 py-2 text-left font-medium"
                      data-no-translate
                    >
                      {row.telemarketer.name}
                    </th>
                    {row.days.map((cell) => (
                      <Cell key={cell.date} cell={cell} />
                    ))}
                    <Cell
                      cell={{ date: '', calls: row.calls, appointments: row.appointments }}
                      total
                      pinned
                    />
                  </tr>
                ))}
              </tbody>
              {data.rows.length > 1 && (
                <tfoot>
                  <tr>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-r border-line bg-column px-3 py-2 text-left font-bold"
                    >
                      全体
                    </th>
                    {data.totals.map((cell) => (
                      <Cell key={cell.date} cell={cell} total />
                    ))}
                    <Cell
                      cell={{ date: '', calls: data.calls, appointments: data.appointments }}
                      total
                      pinned
                    />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

/** One day: the rate on top, the counts under it; a dash when nothing was called. */
function Cell({
  cell,
  total = false,
  pinned = false,
}: {
  cell: CallResultsCell;
  total?: boolean;
  /** The 合計 column stays in view while a month scrolls sideways. */
  pinned?: boolean;
}) {
  return (
    <td
      className={cn(
        'border-r border-b border-line px-2 py-1.5 text-center tabular-nums last:border-r-0',
        total && 'bg-column',
        pinned && 'border-l sm:sticky sm:right-0 sm:z-10',
      )}
    >
      {cell.calls === 0 ? (
        <span className="text-ink-disabled">―</span>
      ) : (
        <>
          <span className={cn('block font-bold', total && 'text-base')}>
            {formatRate(appointmentRate(cell.appointments, cell.calls))}
          </span>
          <span className="block text-xs whitespace-nowrap text-ink-sub">
            A {cell.appointments}／架電 {cell.calls}
          </span>
        </>
      )}
    </td>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border border-line bg-surface px-3 py-2.5 shadow-(--shadow-card) sm:px-4 sm:py-3">
      <p className="text-[11px] font-bold text-ink-sub sm:text-xs">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
    </div>
  );
}
