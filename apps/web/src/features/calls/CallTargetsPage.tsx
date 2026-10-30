import { CompanyFlag, type CompanyListItem, OptionCategory } from '@telesales/shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { paths } from '@/app/paths';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { QueryState } from '@/components/ui/QueryState';
import { Table, Td, Th } from '@/components/ui/Table';
import { useOptionList } from '@/features/reference/useReference';
import { formatDate, formatDateTime, todayJst } from '@/lib/format';
import { useCompanySearch } from './api';
import { FlagBadge, GradeBadge } from './CallBadges';
import {
  CallTargetFilters,
  type Choice,
  type FilterChip,
  type FilterField,
} from './CallTargetFilters';

/** Call target list with AND / OR filters (spec §6). */
export function CallTargetsPage() {
  const [params] = useSearchParams();
  const initialList = params.get('list');
  const [name, setName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [chips, setChips] = useState<FilterChip[]>(
    initialList ? [{ key: 1, field: 'listName', value: initialList }] : [],
  );
  const [match, setMatch] = useState<'AND' | 'OR'>('AND');
  const [onlyTargets, setOnlyTargets] = useState(true);
  // Today's confirmed allocation (priority 2); the home tile links here with ?mine=1.
  const [onlyMine, setOnlyMine] = useState(params.get('mine') === '1');
  const [page, setPage] = useState(1);
  const grades = useOptionList(OptionCategory.CallGrade);
  const customerTypes = useOptionList(OptionCategory.CustomerType);

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
  }));
  const query = useCompanySearch({
    keyword,
    conditions,
    match,
    callTargetsOnly: onlyTargets,
    assignedToMe: onlyMine,
    page,
    pageSize: 50,
  });

  const choicesOf = (field: FilterField): Choice[] | null => {
    if (field === 'lastGrade')
      return grades.items.map((g) => ({ value: g.code, label: `${g.code}：${g.label}` }));
    if (field === 'customerType') return customerTypes.selectOptions;
    if (field === 'flag')
      return [
        { value: CompanyFlag.Duplicate, label: '重複' },
        { value: CompanyFlag.NeedsCheck, label: '要確認' },
      ];
    return null;
  };

  return (
    <div className="flex flex-col gap-4">
      <CallTargetFilters
        name={name}
        onName={setName}
        chips={chips}
        onChips={changed(setChips)}
        match={match}
        onMatch={changed(setMatch)}
        onlyTargets={onlyTargets}
        onOnlyTargets={changed(setOnlyTargets)}
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
                      <Th className="pl-4">会社名</Th>
                      <Th>エリア</Th>
                      <Th className="max-md:hidden">業種</Th>
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
function CompanyRow({ company, gradeLabel }: { company: CompanyListItem; gradeLabel: string }) {
  const navigate = useNavigate();
  const today = todayJst();
  const due = company.nextCallDate !== null && company.nextCallDate <= today;
  const open = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('a,button')) return;
    if (window.getSelection()?.toString()) return;
    navigate(paths.company(company.id));
  };
  return (
    <tr
      onClick={open}
      className="cursor-pointer transition-colors duration-100 hover:bg-main-soft/60 [&>td]:py-2.5"
    >
      <Td className="pl-4">
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
          </div>
        </div>
      </Td>
      <Td className="whitespace-nowrap">
        {company.prefecture}
        {company.city && <span className="ml-1 text-ink-sub">{company.city}</span>}
      </Td>
      <Td className="max-w-36 truncate max-md:hidden" title={company.industry ?? undefined}>
        {company.industry}
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
