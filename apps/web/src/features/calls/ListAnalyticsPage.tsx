import type { ListAnalyticsList } from '@telesales/shared';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { Card } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Table, Td, Th } from '@/components/ui/Table';
import { formatDate } from '@/lib/format';
import { jstDate } from '@telesales/shared';
import { useListAnalytics } from './api';

const percent = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : '―';

/**
 * リスト分析 (request 11/27, telemarketing leads): the lists the company buys, side by side —
 * how much of each was new, how much was already registered, which lists repeat each other,
 * and which companies keep coming back.
 */
export function ListAnalyticsPage() {
  const query = useListAnalytics();
  return (
    <QueryState query={query}>
      {({ totals, lists, repeated }) =>
        lists.length === 0 ? (
          <Card>
            <EmptyState>まだリストを取り込んでいません。</EmptyState>
          </Card>
        ) : (
          <div className="flex flex-col gap-5">
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Stat label="取り込んだリスト" value={`${totals.lists}`} unit="件" />
              <Stat label="読み込んだ行" value={totals.rows.toLocaleString()} unit="行" />
              <Stat
                label="新規に登録"
                value={totals.created.toLocaleString()}
                unit="社"
                note={percent(totals.created, totals.rows)}
              />
              <Stat
                label="登録済み（重複）"
                value={totals.duplicates.toLocaleString()}
                unit="社"
                note={percent(totals.duplicates, totals.rows)}
                tone="warning"
              />
              <Stat
                label="複数のリストに入った企業"
                value={totals.repeatedCompanies.toLocaleString()}
                unit="社"
                tone="warning"
              />
              <Stat
                label="読めなかった行"
                value={totals.problems.toLocaleString()}
                unit="行"
                tone={totals.problems > 0 ? 'danger' : undefined}
              />
            </dl>

            <Card title="リストごと" flush>
              <Table>
                <thead>
                  <tr>
                    <Th className="min-w-56">リスト名</Th>
                    <Th className="text-right">行数</Th>
                    <Th className="min-w-56">新規・重複・その他</Th>
                    <Th className="text-right">アポ</Th>
                    <Th className="min-w-48">よく重なるリスト</Th>
                  </tr>
                </thead>
                <tbody>
                  {lists.map((list) => (
                    <tr key={list.id}>
                      <Td>
                        <p className="font-bold" data-no-translate>
                          {list.listName}
                        </p>
                        <p className="text-xs text-ink-sub">
                          {formatDate(jstDate(new Date(list.importedAt)))}
                        </p>
                      </Td>
                      <Td className="text-right whitespace-nowrap tabular-nums">
                        {list.rows.toLocaleString()}
                      </Td>
                      <Td>
                        <MixBar list={list} />
                      </Td>
                      <Td className="text-right whitespace-nowrap tabular-nums">
                        {list.appointments}
                      </Td>
                      <Td className="text-xs">
                        {list.overlaps.length === 0 ? (
                          <span className="text-ink-sub">なし</span>
                        ) : (
                          <ul className="flex flex-col gap-0.5">
                            {list.overlaps.map((overlap) => (
                              <li key={overlap.listImportId} data-no-translate>
                                {overlap.listName}
                                <span className="ml-1.5 font-bold text-warning-ink tabular-nums">
                                  {overlap.shared}社
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>

            <Card title={`何度も入ってきた企業（${repeated.length}社）`} flush>
              {repeated.length === 0 ? (
                <EmptyState>2つ以上のリストに入った企業はありません。</EmptyState>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th className="min-w-48">会社名</Th>
                      <Th>電話番号</Th>
                      <Th className="text-right">回数</Th>
                      <Th className="min-w-64">入っていたリスト（古い順）</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {repeated.map(({ company, lists: on }) => (
                      <tr key={company.id}>
                        <Td>
                          <Link
                            to={paths.company(company.id)}
                            className="font-bold text-link hover:underline"
                          >
                            {company.name}
                          </Link>
                        </Td>
                        <Td className="whitespace-nowrap tabular-nums">{company.phone}</Td>
                        <Td className="text-right font-bold tabular-nums">{on.length}</Td>
                        <Td className="text-xs">
                          <span className="flex flex-wrap gap-1">
                            {on.map((list) => (
                              <span
                                key={list.listImportId}
                                data-no-translate
                                className="border border-line bg-column px-1.5 py-0.5"
                              >
                                {list.listName}
                              </span>
                            ))}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>
        )
      }
    </QueryState>
  );
}

function Stat({
  label,
  value,
  unit,
  note,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  note?: string;
  tone?: 'warning' | 'danger';
}) {
  return (
    <div className="border border-line bg-surface px-4 py-3 shadow-(--shadow-card)">
      <dt className="text-xs text-ink-sub">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-1">
        <span
          className={cn(
            'text-2xl font-bold tabular-nums',
            tone === 'warning' && 'text-warning-ink',
            tone === 'danger' && 'text-danger',
          )}
        >
          {value}
        </span>
        <span className="text-xs text-ink-sub">{unit}</span>
        {note && <span className="ml-auto text-xs text-ink-sub tabular-nums">{note}</span>}
      </dd>
    </div>
  );
}

/** One bar per list: new / already registered / needs a look / could not be read / left out. */
function MixBar({ list }: { list: ListAnalyticsList }) {
  const parts = [
    { key: 'new', label: '新規', value: list.created, className: 'bg-success' },
    { key: 'dup', label: '重複', value: list.duplicates, className: 'bg-warning' },
    { key: 'check', label: '要確認', value: list.needsCheck, className: 'bg-schedule' },
    { key: 'bad', label: '不備', value: list.problems, className: 'bg-danger' },
    {
      key: 'out',
      label: '回避・電話なし',
      value: list.avoided + list.noPhone,
      className: 'bg-line-strong',
    },
  ];
  const total = Math.max(1, list.rows);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-2.5 w-full overflow-hidden bg-column" aria-hidden="true">
        {parts.map((part) =>
          part.value > 0 ? (
            <span
              key={part.key}
              className={part.className}
              style={{ width: `${(part.value / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <p className="flex flex-wrap gap-x-2.5 text-xs text-ink-sub tabular-nums">
        {parts
          .filter((part) => part.value > 0)
          .map((part) => (
            <span key={part.key} className="inline-flex items-center gap-1">
              <span className={cn('inline-block size-2', part.className)} aria-hidden="true" />
              {part.label} {part.value}
              {part.key === 'dup' && `（${percent(part.value, list.rows)}）`}
            </span>
          ))}
      </p>
    </div>
  );
}
