import { type CompanyFilterCondition, OptionCategory } from '@telesales/shared';
import { Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { paths } from '@/app/paths';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { QueryState } from '@/components/ui/QueryState';
import { Select } from '@/components/ui/Select';
import { Table, Td, Th } from '@/components/ui/Table';
import { TextInput } from '@/components/ui/TextInput';
import { useOptionList } from '@/features/reference/useReference';
import { formatDate, formatDateTime, todayJst } from '@/lib/format';
import { useCompanySearch } from './api';
import { FlagBadge, GradeBadge } from './CallBadges';

type Field = CompanyFilterCondition['field'];

const FIELDS: { value: Field; label: string; needsValue: boolean }[] = [
  { value: 'name', label: '会社名', needsValue: true },
  { value: 'prefecture', label: '都道府県', needsValue: true },
  { value: 'city', label: '市区町村', needsValue: true },
  { value: 'industry', label: '業種', needsValue: true },
  { value: 'listName', label: 'リスト名', needsValue: true },
  { value: 'customerType', label: '取引区分', needsValue: true },
  { value: 'lastGrade', label: '最新の判定', needsValue: true },
  { value: 'nextCallDue', label: 'B次回架電日が来ている', needsValue: false },
  { value: 'neverCalled', label: 'まだ架電していない', needsValue: false },
  { value: 'flag', label: '重複・要確認', needsValue: true },
];

interface Row {
  key: number;
  field: Field;
  value: string;
}

/** Call target list with AND / OR filters (spec §6). */
export function CallTargetsPage() {
  const [params] = useSearchParams();
  const initialList = params.get('list');
  const [rows, setRows] = useState<Row[]>(
    initialList
      ? [{ key: 1, field: 'listName', value: initialList }]
      : [{ key: 1, field: 'name', value: '' }],
  );
  const [match, setMatch] = useState<'AND' | 'OR'>('AND');
  const [onlyTargets, setOnlyTargets] = useState(true);
  // Today's confirmed allocation (priority 2); the home tile links here with ?mine=1.
  const [onlyMine, setOnlyMine] = useState(params.get('mine') === '1');
  const [applied, setApplied] = useState({ rows, match, onlyTargets, onlyMine });
  const [page, setPage] = useState(1);
  const grades = useOptionList(OptionCategory.CallGrade);
  const customerTypes = useOptionList(OptionCategory.CustomerType);

  const conditions = applied.rows
    .filter((row) => !FIELDS.find((f) => f.value === row.field)?.needsValue || row.value.trim())
    .map((row) => ({
      field: row.field,
      value: row.field === 'nextCallDue' ? todayJst() : row.value,
    }));
  const query = useCompanySearch({
    conditions,
    match: applied.match,
    callTargetsOnly: applied.onlyTargets,
    assignedToMe: applied.onlyMine,
    page,
    pageSize: 50,
  });

  const update = (key: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const apply = () => {
    setApplied({ rows, match, onlyTargets, onlyMine });
    setPage(1);
  };

  const valueControl = (row: Row) => {
    const field = FIELDS.find((f) => f.value === row.field);
    if (!field?.needsValue)
      return (
        <span className="flex h-11 items-center text-sm text-ink-sub">条件の値は不要です</span>
      );
    if (row.field === 'lastGrade') {
      return (
        <Select
          aria-label="値"
          value={row.value}
          placeholder="選択"
          options={grades.selectOptions.map((o) => ({
            value: o.value,
            label: `${o.value}：${o.label}`,
          }))}
          onChange={(e) => update(row.key, { value: e.target.value })}
        />
      );
    }
    if (row.field === 'customerType') {
      return (
        <Select
          aria-label="値"
          value={row.value}
          placeholder="選択"
          options={customerTypes.selectOptions}
          onChange={(e) => update(row.key, { value: e.target.value })}
        />
      );
    }
    if (row.field === 'flag') {
      return (
        <Select
          aria-label="値"
          value={row.value}
          placeholder="選択"
          options={[
            { value: 'DUPLICATE', label: '重複' },
            { value: 'NEEDS_CHECK', label: '要確認' },
          ]}
          onChange={(e) => update(row.key, { value: e.target.value })}
        />
      );
    }
    return (
      <TextInput
        aria-label="値"
        value={row.value}
        onChange={(e) => update(row.key, { value: e.target.value })}
        onKeyDown={(e) => e.key === 'Enter' && apply()}
      />
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <Card title="絞り込み">
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <div
              key={row.key}
              className="grid gap-2 sm:grid-cols-[3.5rem_14rem_1fr_auto] sm:items-center"
            >
              <span className="text-sm font-bold text-ink-sub">
                {index === 0 ? '条件' : match === 'AND' ? 'かつ' : 'または'}
              </span>
              <Select
                aria-label="項目"
                value={row.field}
                options={FIELDS}
                onChange={(e) => update(row.key, { field: e.target.value as Field, value: '' })}
              />
              {valueControl(row)}
              <Button
                variant="text"
                aria-label="条件を削除"
                disabled={rows.length === 1}
                onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                icon={<X className="size-4" aria-hidden="true" />}
              />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Button
              variant="secondary"
              icon={<Plus className="size-4" aria-hidden="true" />}
              disabled={rows.length >= 10}
              onClick={() =>
                setRows((current) => [
                  ...current,
                  { key: Date.now(), field: 'prefecture', value: '' },
                ])
              }
            >
              条件を追加
            </Button>
            <fieldset className="flex items-center gap-4">
              <legend className="sr-only">条件のつなぎ方</legend>
              <Checkbox
                type="radio"
                name="match"
                label="すべて満たす（AND）"
                checked={match === 'AND'}
                onChange={() => setMatch('AND')}
              />
              <Checkbox
                type="radio"
                name="match"
                label="どれかを満たす（OR）"
                checked={match === 'OR'}
                onChange={() => setMatch('OR')}
              />
            </fieldset>
            <Checkbox
              label="架電対象だけ"
              checked={onlyTargets}
              onChange={(e) => setOnlyTargets(e.target.checked)}
            />
            <Checkbox
              label="今日の自分の担当だけ"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
            />
            <Button
              className="sm:ml-auto"
              icon={<Search className="size-4" aria-hidden="true" />}
              onClick={apply}
            >
              検索
            </Button>
          </div>
        </div>
      </Card>

      <Card flush>
        <QueryState query={query}>
          {(data) =>
            data.items.length === 0 ? (
              <EmptyState mood="think">条件に合う企業はありません。</EmptyState>
            ) : (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>会社名</Th>
                      <Th>エリア</Th>
                      <Th className="max-md:hidden">業種</Th>
                      <Th className="max-lg:hidden">リスト名</Th>
                      <Th>最新の架電</Th>
                      <Th>B次回架電日</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((company) => (
                      <tr key={company.id} className="hover:bg-canvas">
                        <Td>
                          <Link
                            to={paths.company(company.id)}
                            className="font-bold text-link hover:underline"
                          >
                            {company.name}
                          </Link>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-sub">
                            {company.office && <span>{company.office}</span>}
                            {company.phone && <span>{company.phone}</span>}
                            <FlagBadge flag={company.flag} />
                          </div>
                        </Td>
                        <Td className="whitespace-nowrap">
                          {[company.prefecture, company.city].filter(Boolean).join(' ')}
                        </Td>
                        <Td className="max-md:hidden">{company.industry}</Td>
                        <Td className="max-lg:hidden">{company.listName}</Td>
                        <Td className="whitespace-nowrap">
                          {company.lastCall ? (
                            <div className="flex flex-col gap-1">
                              <GradeBadge
                                grade={company.lastCall.grade}
                                label={grades.labelOf(company.lastCall.grade)}
                              />
                              <span className="text-xs text-ink-sub">
                                {formatDateTime(company.lastCall.calledAt)}・
                                {company.lastCall.telemarketer.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-ink-disabled">未架電</span>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap">
                          {company.nextCallDate ? formatDate(company.nextCallDate) : ''}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <Pagination
                  page={data.page}
                  pageSize={data.pageSize}
                  total={data.total}
                  onChange={setPage}
                />
              </>
            )
          }
        </QueryState>
      </Card>
    </div>
  );
}
