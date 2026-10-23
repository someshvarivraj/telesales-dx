import { addDays, OptionCategory, PREFECTURE_NAMES, Role } from '@telesales/shared';
import { useState } from 'react';
import { DatePicker } from '@/components/ui/DatePicker';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryState } from '@/components/ui/QueryState';
import { Select } from '@/components/ui/Select';
import { Table, Td, Th } from '@/components/ui/Table';
import { useIndustries, useListNames } from '@/features/calls/api';
import { useOptionList, usePeople } from '@/features/reference/useReference';
import { formatPercent, monthRange, startOfWeek, todayJst } from '@/lib/format';
import { ja } from '@/i18n/ja';
import { useDashboard } from './api';

const PRESETS = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '今週' },
  { value: 'month', label: '今月' },
  { value: 'lastMonth', label: '先月' },
  { value: 'custom', label: '期間を指定' },
] as const;

function presetRange(preset: string): { from: string; to: string } {
  const today = todayJst();
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'week') return { from: startOfWeek(today), to: addDays(startOfWeek(today), 6) };
  if (preset === 'lastMonth') return monthRange(addDays(monthRange(today).from, -1));
  return monthRange(today);
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-(--radius-card) border border-line bg-surface p-4 shadow-(--shadow-card)">
      <div className="text-xs font-bold text-ink-sub">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-sub">{sub}</div>}
    </div>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-column">
      <div
        className="h-2 rounded-full bg-main"
        style={{ width: `${max > 0 ? Math.round((value / max) * 100) : 0}%` }}
      />
    </div>
  );
}

/** Basic dashboard (spec §6): calls, appointments, rate, meeting status; by period, person and list. */
export function DashboardPage() {
  const [preset, setPreset] = useState<string>('month');
  const [range, setRange] = useState(presetRange('month'));
  const [filters, setFilters] = useState({
    telemarketerId: '',
    salesRepId: '',
    listName: '',
    industry: '',
    prefecture: '',
  });
  const telemas = usePeople(Role.Telema);
  const reps = usePeople(Role.Sales);
  const lists = useListNames();
  const industries = useIndustries();
  const grades = useOptionList(OptionCategory.CallGrade);
  const query = useDashboard({
    ...range,
    telemarketerId: filters.telemarketerId || undefined,
    salesRepId: filters.salesRepId || undefined,
    listName: filters.listName || undefined,
    industry: filters.industry || undefined,
    prefecture: filters.prefecture || undefined,
  });

  return (
    <>
      <PageHeader title={ja.module.dashboard} />
      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="期間">
            {(c) => (
              <Select
                {...c}
                value={preset}
                options={PRESETS}
                onChange={(e) => {
                  setPreset(e.target.value);
                  if (e.target.value !== 'custom') setRange(presetRange(e.target.value));
                }}
              />
            )}
          </FormField>
          <FormField label="から">
            {(c) => (
              <DatePicker
                {...c}
                value={range.from}
                disabled={preset !== 'custom'}
                onChange={(e) => setRange({ ...range, from: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="まで">
            {(c) => (
              <DatePicker
                {...c}
                value={range.to}
                disabled={preset !== 'custom'}
                onChange={(e) => setRange({ ...range, to: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="テレマ">
            {(c) => (
              <Select
                {...c}
                value={filters.telemarketerId}
                placeholder={ja.common.all}
                options={(telemas.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                onChange={(e) => setFilters({ ...filters, telemarketerId: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="担当営業">
            {(c) => (
              <Select
                {...c}
                value={filters.salesRepId}
                placeholder={ja.common.all}
                options={(reps.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                onChange={(e) => setFilters({ ...filters, salesRepId: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="リスト">
            {(c) => (
              <Select
                {...c}
                value={filters.listName}
                placeholder={ja.common.all}
                options={(lists.data ?? []).map((name) => ({ value: name, label: name }))}
                onChange={(e) => setFilters({ ...filters, listName: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="業種">
            {(c) => (
              <Select
                {...c}
                value={filters.industry}
                placeholder={ja.common.all}
                options={(industries.data ?? []).map((name) => ({ value: name, label: name }))}
                onChange={(e) => setFilters({ ...filters, industry: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="地域（都道府県）">
            {(c) => (
              <Select
                {...c}
                value={filters.prefecture}
                placeholder={ja.common.all}
                options={PREFECTURE_NAMES.map((name) => ({ value: name, label: name }))}
                onChange={(e) => setFilters({ ...filters, prefecture: e.target.value })}
              />
            )}
          </FormField>
        </div>
      </Card>
      <QueryState query={query}>
        {(data) => {
          const maxPerson = Math.max(1, ...data.byTelemarketer.map((row) => row.calls));
          return (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <Kpi label="架電数" value={data.calls} sub="① で入力した架電" />
                <Kpi label="アポ数" value={data.appointments} sub="取り消しを除く" />
                <Kpi
                  label="アポ率"
                  value={formatPercent(data.appointmentRate)}
                  sub="① のアポ ÷ 架電数"
                />
                <Kpi
                  label="打ち合わせ予定"
                  value={data.meetings.scheduled}
                  sub={`結果待ち ${data.meetings.awaitingResult}件`}
                />
                <Kpi
                  label="結果入力済み"
                  value={data.meetings.completed}
                  sub={`取り消し ${data.meetings.cancelled}件`}
                />
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <Card title="テレマごと" flush>
                  <Table>
                    <thead>
                      <tr>
                        <Th>テレマ</Th>
                        <Th className="w-40">架電</Th>
                        <Th>アポ</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byTelemarketer.map((row) => (
                        <tr key={row.user.id}>
                          <Td>{row.user.name}</Td>
                          <Td>
                            <div className="flex items-center gap-2">
                              <span className="w-8 text-right tabular-nums">{row.calls}</span>
                              <Bar value={row.calls} max={maxPerson} />
                            </div>
                          </Td>
                          <Td className="tabular-nums">{row.appointments}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card>
                <Card title="営業ごと" flush>
                  <Table>
                    <thead>
                      <tr>
                        <Th>営業</Th>
                        <Th>アポ</Th>
                        <Th>結果入力済み</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bySalesRep.map((row) => (
                        <tr key={row.user.id}>
                          <Td>{row.user.name}</Td>
                          <Td className="tabular-nums">{row.appointments}</Td>
                          <Td className="tabular-nums">{row.completed}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card>
                <Card title="リストごと" flush>
                  <Table>
                    <thead>
                      <tr>
                        <Th>リスト名</Th>
                        <Th>架電</Th>
                        <Th>アポ</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byList.map((row) => (
                        <tr key={row.listName}>
                          <Td>{row.listName}</Td>
                          <Td className="tabular-nums">{row.calls}</Td>
                          <Td className="tabular-nums">{row.appointments}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card>
                <Card title="判定ごと">
                  <ul className="flex flex-col gap-3">
                    {data.byGrade.map((row) => (
                      <li key={row.grade} className="flex items-center gap-3 text-sm">
                        <span className="w-24 shrink-0">
                          {row.grade}：{grades.labelOf(row.grade)}
                        </span>
                        <Bar
                          value={row.count}
                          max={Math.max(1, ...data.byGrade.map((g) => g.count))}
                        />
                        <span className="w-10 text-right tabular-nums">{row.count}</span>
                      </li>
                    ))}
                    {data.byGrade.length === 0 && (
                      <li className="text-sm text-ink-sub">この期間の架電はありません。</li>
                    )}
                  </ul>
                </Card>
              </div>
            </div>
          );
        }}
      </QueryState>
    </>
  );
}
