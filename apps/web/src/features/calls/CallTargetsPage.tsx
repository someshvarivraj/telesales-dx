import {
  CompanyFlag,
  type CompanyListItem,
  formatCapital,
  gradeOfResult,
  INDUSTRIES,
  OptionCategory,
  Permission,
  Role,
} from '@telesales/shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { paths } from '@/app/paths';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { QueryState } from '@/components/ui/QueryState';
import { Table, Td, Th } from '@/components/ui/Table';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { useOptionList, usePeople } from '@/features/reference/useReference';
import { cn } from '@/components/ui/cn';
import { formatDate, formatDateKanji, formatDateTime, todayJst } from '@/lib/format';
import { useCityNames, useCompanySearch, useSetCallTargets } from './api';
import { FlagBadge, GradeBadge, SAreaBadge } from './CallBadges';
import {
  CallTargetFilters,
  type CallList,
  type Choice,
  type FilterChip,
  type FilterField,
} from './CallTargetFilters';

/** Call target list with AND / OR filters (spec §6). */
/** 事業所名 words offered in 詳細検索 (本社＋支社＋工場 …); anything else can be typed. */
const OFFICE_WORDS = ['本社', '支社', '支店', '営業所', '事業所', '工場', '研究所', '出張所'];

export function CallTargetsPage() {
  const [params] = useSearchParams();
  const initialList = params.get('list');
  const [name, setName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [chips, setChips] = useState<FilterChip[]>(
    initialList ? [{ key: 1, field: 'listName', value: initialList, values: [] }] : [],
  );
  const [match, setMatch] = useState<'AND' | 'OR'>('AND');
  const [list, setList] = useState<CallList>(
    params.get('targets') === 'later' ? 'NON_TARGETS' : 'TARGETS',
  );
  const canImport = usePermission(Permission.ImportLists);
  const isAdmin = usePermission(Permission.Administer);
  const canMove = canImport || isAdmin;
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const move = useSetCallTargets();
  // Today's confirmed allocation (priority 2); the home tile links here with ?mine=1.
  const [onlyMine, setOnlyMine] = useState(params.get('mine') === '1');
  const [page, setPage] = useState(1);
  const grades = useOptionList(OptionCategory.CallGrade);
  const customerTypes = useOptionList(OptionCategory.CustomerType);
  const ranks = useOptionList(OptionCategory.CompanyRank);
  const results = useOptionList(OptionCategory.CallResult);
  const cities = useCityNames();
  const people = usePeople();
  const telemarketers = (people.data ?? []).filter((person) =>
    person.roles.some((role) => role === Role.Telema || role === Role.TelemaLead),
  );

  const salesReps = (people.data ?? []).filter((person) => person.roles.includes(Role.Sales));

  // The list follows the keyword box shortly after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(name.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [name]);
  const changed =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };

  const conditions = chips.map((chip) => ({
    field: chip.field,
    value: chip.field === 'nextCallDue' ? todayJst() : chip.value,
    values: chip.values,
  }));
  const query = useCompanySearch({
    keyword,
    conditions,
    match,
    callTargetsOnly: list === 'TARGETS',
    nonTargetsOnly: list === 'NON_TARGETS',
    assignedToMe: onlyMine,
    page,
    pageSize: 50,
  });

  const choicesOf = (field: FilterField): Choice[] => {
    // Each grade with its detailed results under it (request 11/2 ②).
    if (field === 'lastGrade')
      return grades.items.flatMap((g) => [
        { value: g.code, label: `${g.code}：${g.label}` },
        ...results.items
          .filter((result) => gradeOfResult(result.code) === g.code)
          .map((result) => ({ value: result.code, label: result.label, nested: true })),
      ]);
    if (field === 'industry') return INDUSTRIES.map((value) => ({ value, label: value }));
    if (field === 'office') return OFFICE_WORDS.map((value) => ({ value, label: value }));
    if (field === 'address') return (cities.data ?? []).map((value) => ({ value, label: value }));
    if (field === 'salesRep')
      return salesReps.map((person) => ({ value: person.id, label: person.name }));
    if (field === 'customerType') return customerTypes.selectOptions;
    if (field === 'companyRank') return ranks.selectOptions;
    if (field === 'telemarketer')
      return telemarketers.map((person) => ({ value: person.id, label: person.name }));
    if (field === 'flag')
      return [
        { value: CompanyFlag.Duplicate, label: '重複' },
        { value: CompanyFlag.NeedsCheck, label: '要確認' },
      ];
    return [];
  };

  const selectable = canMove && list !== 'ALL';

  return (
    <div className="flex flex-col gap-4">
      <CallTargetFilters
        name={name}
        onName={setName}
        chips={chips}
        onChips={changed(setChips)}
        match={match}
        onMatch={changed(setMatch)}
        list={list}
        onList={(value) => {
          setList(value);
          setPicked(new Set());
          setPage(1);
        }}
        onlyMine={onlyMine}
        onOnlyMine={changed(setOnlyMine)}
        choicesOf={choicesOf}
      />

      <section
        aria-label="企業一覧"
        className="border border-line bg-surface shadow-(--shadow-card)"
      >
        <QueryState query={query}>
          {(data) =>
            data.items.length === 0 ? (
              <EmptyState mood="think">条件に合う企業はありません。</EmptyState>
            ) : (
              <>
                {selectable && (
                  <div className="flex flex-wrap items-center gap-3 border-b border-line bg-column px-4 py-2.5">
                    <span className="text-sm text-ink-sub">
                      {picked.size > 0
                        ? `${picked.size}件を選んでいます`
                        : list === 'NON_TARGETS'
                          ? '架電を始める企業を選んで「架電対象にする」を押してください。'
                          : '今は架電しない企業を選んで「架電対象外にする」を押してください。'}
                    </span>
                    {move.data && !move.isPending && (
                      <span className="text-sm text-success">
                        {`${move.data.changed}件を移しました`}
                        {move.data.skipped > 0 &&
                          `（回避企業・重複の${move.data.skipped}件は移していません）`}
                      </span>
                    )}
                    <Button
                      className="ml-auto"
                      size="sm"
                      variant={list === 'NON_TARGETS' ? 'primary' : 'secondary'}
                      disabled={picked.size === 0}
                      loading={move.isPending}
                      onClick={() =>
                        move.mutate(
                          { companyIds: [...picked], isCallTarget: list === 'NON_TARGETS' },
                          { onSuccess: () => setPicked(new Set()) },
                        )
                      }
                    >
                      {list === 'NON_TARGETS' ? '架電対象にする' : '架電対象外にする'}
                    </Button>
                  </div>
                )}
                <div className="border-b border-line">
                  <Pagination
                    page={data.page}
                    pageSize={data.pageSize}
                    total={data.total}
                    onChange={setPage}
                  />
                </div>
                <Table stickyHeader>
                  <thead>
                    <tr>
                      {selectable && (
                        <Th className="w-0 pl-4">
                          <input
                            type="checkbox"
                            className="check-input"
                            aria-label="このページをすべて選ぶ"
                            checked={data.items.every((item) => picked.has(item.id))}
                            onChange={(event) =>
                              setPicked((current) => {
                                const next = new Set(current);
                                for (const item of data.items) {
                                  if (event.target.checked) next.add(item.id);
                                  else next.delete(item.id);
                                }
                                return next;
                              })
                            }
                          />
                        </Th>
                      )}
                      <Th className={selectable ? undefined : 'pl-4'}>会社名</Th>
                      <Th>エリア</Th>
                      <Th className="max-md:hidden">業種・ランク・資本金</Th>
                      <Th className="max-lg:hidden">リスト名</Th>
                      <Th>最新の架電</Th>
                      <Th className="pr-4">B次回架電日</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((company) => (
                      <CompanyRow
                        key={company.id}
                        company={company}
                        gradeLabel={grades.labelOf(company.lastCall?.grade)}
                        rankLabel={company.companyRank ? ranks.labelOf(company.companyRank) : null}
                        picked={selectable ? picked.has(company.id) : undefined}
                        onPick={(on) =>
                          setPicked((current) => {
                            const next = new Set(current);
                            if (on) next.add(company.id);
                            else next.delete(company.id);
                            return next;
                          })
                        }
                      />
                    ))}
                  </tbody>
                </Table>
                <div className="border-t border-line">
                  <Pagination
                    page={data.page}
                    pageSize={data.pageSize}
                    total={data.total}
                    onChange={setPage}
                  />
                </div>
              </>
            )
          }
        </QueryState>
      </section>
    </div>
  );
}

/** One company; the whole row opens it (the name stays a real link for keyboards). */
function CompanyRow({
  company,
  gradeLabel,
  rankLabel,
  picked,
  onPick,
}: {
  company: CompanyListItem;
  rankLabel: string | null;
  gradeLabel: string;
  /** Shown with a checkbox when companies can be moved between the lists. */
  picked?: boolean;
  onPick: (on: boolean) => void;
}) {
  const navigate = useNavigate();
  const today = todayJst();
  const due = company.nextCallDate !== null && company.nextCallDate <= today;
  const open = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('a,button,input,label')) return;
    if (window.getSelection()?.toString()) return;
    navigate(paths.company(company.id));
  };
  return (
    <tr
      onClick={open}
      className="cursor-pointer transition-colors duration-100 hover:bg-main-soft/60 [&>td]:py-2.5"
    >
      {picked !== undefined && (
        <Td className="pl-4">
          <input
            type="checkbox"
            className="check-input mt-1"
            aria-label={`${company.name}を選ぶ`}
            checked={picked}
            onChange={(event) => onPick(event.target.checked)}
          />
        </Td>
      )}
      <Td className={picked !== undefined ? undefined : 'pl-4'}>
        <div className="min-w-44">
          <Link
            to={paths.company(company.id)}
            className="font-bold text-ink hover:text-link hover:underline"
          >
            {company.name}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-sub">
            {company.office && <span>{company.office}</span>}
            {company.phone && (
              <span className="whitespace-nowrap tabular-nums">{company.phone}</span>
            )}
            <FlagBadge flag={company.flag} />
            <SAreaBadge prefecture={company.prefecture} />
          </div>
        </div>
      </Td>
      <Td className="whitespace-nowrap">
        {company.prefecture}
        {company.city && <span className="ml-1 text-ink-sub">{company.city}</span>}
      </Td>
      <Td className="max-w-44 max-md:hidden">
        <div className="truncate" title={company.industry ?? undefined}>
          {company.industry}
        </div>
        {(rankLabel || company.capital !== null) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-sub">
            {rankLabel && <span className="font-bold text-ink">{rankLabel}</span>}
            {company.capital !== null && (
              <span className="tabular-nums">{formatCapital(company.capital)}</span>
            )}
          </div>
        )}
      </Td>
      <Td className="max-lg:hidden">
        {company.listName && (
          <span
            title={company.listName}
            className="inline-block max-w-48 truncate border border-line bg-column px-1.5 py-0.5 align-top text-xs text-ink-sub"
          >
            {company.listName}
          </span>
        )}
      </Td>
      <Td className="whitespace-nowrap">
        {company.lastCall ? (
          <div className="flex flex-col gap-0.5">
            <GradeBadge grade={company.lastCall.grade} label={gradeLabel} />
            <span className="text-xs text-ink-sub tabular-nums">
              {formatDateTime(company.lastCall.calledAt)}・{company.lastCall.telemarketer.name}
            </span>
            {company.lastCall.avoidUntil && (
              <span
                className={cn(
                  'w-fit px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
                  company.lastCall.avoidUntil >= today
                    ? 'bg-warning-soft text-warning-ink'
                    : 'bg-column text-ink-sub',
                )}
              >
                {company.lastCall.avoidUntil >= today
                  ? `${formatDateKanji(company.lastCall.avoidUntil)}までは架電回避`
                  : `${formatDateKanji(company.lastCall.avoidUntil)}まで架電回避（終了）`}
              </span>
            )}
          </div>
        ) : (
          <span className="inline-block border border-dashed border-line-strong px-1.5 py-0.5 text-xs text-ink-sub">
            未架電
          </span>
        )}
      </Td>
      <Td className="pr-4 whitespace-nowrap tabular-nums">
        {company.nextCallDate &&
          (due ? (
            <span className="font-bold text-warning-ink">
              {formatDate(company.nextCallDate)}
              <span className="ml-1.5 bg-warning-soft px-1.5 py-0.5 text-[11px]">
                {company.nextCallDate === today ? '今日' : '過ぎています'}
              </span>
            </span>
          ) : (
            formatDate(company.nextCallDate)
          ))}
      </Td>
    </tr>
  );
}
