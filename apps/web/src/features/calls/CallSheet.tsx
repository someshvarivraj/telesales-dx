import { type CompanyListItem, type CompanySort, jstDate } from '@telesales/shared';
import { ArrowDown, CalendarDays } from 'lucide-react';
import type { Dispatch, MouseEvent, SetStateAction } from 'react';
import { Link, useNavigate } from 'react-router';
import { paths } from '@/app/paths';
import { cn } from '@/components/ui/cn';
import { Table, Td, Th } from '@/components/ui/Table';
import { formatDate } from '@/lib/format';
import { useSalesPanel } from './SalesPanel';

interface CallSheetProps {
  items: CompanyListItem[];
  sort: CompanySort;
  onSort: (sort: CompanySort) => void;
  gradeLabelOf: (code: string | null | undefined) => string;
  resultLabelOf: (code: string | null | undefined) => string;
  /** With checkboxes when companies can be picked (一括修正・割り振り). */
  picked?: Set<string>;
  setPicked?: Dispatch<SetStateAction<Set<string>>>;
}

/** The address as one line: 都道府県, 市区町村 and the rest (not repeated when already in it). */
function fullAddress(company: CompanyListItem): string {
  const rest = company.address ?? '';
  const head = [company.prefecture, company.city]
    .filter((part): part is string => Boolean(part) && !rest.includes(part as string))
    .join('');
  return `${head}${rest}`;
}

/**
 * 架電用の一覧 (テレマ 11/18, 資料A): every item a telemarketer looks at while calling, one row
 * per company, as in the テレマリスト管理 screen they know — テレマID, 業種, 会社名, 事業所,
 * 部署, 電話, 住所, 最寄駅, the latest call (判定, 結果, 日付), 回数, テレマ担当者 and リスト名.
 * The 会社名 and 住所 headers sort the list: 住所 → north to south; 会社名 → by name, keeping
 * the address order inside each name (so one company's offices come together).
 */
export function CallSheet({
  items,
  sort,
  onSort,
  gradeLabelOf,
  resultLabelOf,
  picked,
  setPicked,
}: CallSheetProps) {
  const navigate = useNavigate();
  const panel = useSalesPanel();
  const open = (event: MouseEvent, id: string) => {
    if ((event.target as HTMLElement).closest('a,button,input,label')) return;
    if (window.getSelection()?.toString()) return;
    navigate(paths.company(id));
  };
  const sortHeader = (label: string, by: CompanySort) => {
    const active = sort === by || (by === 'ADDRESS' && sort === 'ADDRESS_NAME');
    return (
      <button
        type="button"
        onClick={() => onSort(active ? 'UPDATED' : by)}
        title={active ? '並び替えをやめる' : `${label}で並び替え`}
        className={cn(
          'inline-flex cursor-pointer items-center gap-1 whitespace-nowrap hover:text-main',
          active && 'text-main',
        )}
      >
        {label}
        <ArrowDown
          aria-hidden="true"
          className={cn('size-3.5', active ? 'opacity-100' : 'opacity-30')}
        />
      </button>
    );
  };
  const cell = 'px-2 py-2 text-xs whitespace-nowrap';

  return (
    <Table stickyHeader>
      <thead>
        <tr className="[&>th]:px-2 [&>th]:text-xs">
          {picked && setPicked && (
            <Th className="w-0 pl-4">
              <input
                type="checkbox"
                className="check-input"
                aria-label="このページをすべて選ぶ"
                checked={items.length > 0 && items.every((item) => picked.has(item.id))}
                onChange={(event) =>
                  setPicked((current) => {
                    const next = new Set(current);
                    for (const item of items) {
                      if (event.target.checked) next.add(item.id);
                      else next.delete(item.id);
                    }
                    return next;
                  })
                }
              />
            </Th>
          )}
          <Th className={picked ? undefined : 'pl-4'}>テレマID</Th>
          <Th>業種</Th>
          <Th>{sortHeader('会社名', 'NAME')}</Th>
          <Th>事業所名</Th>
          <Th>部署名</Th>
          <Th>電話番号</Th>
          <Th>{sortHeader('住所', 'ADDRESS')}</Th>
          <Th>最寄駅</Th>
          <Th>判定</Th>
          <Th>最新テレマ結果</Th>
          <Th>最新テレマ日</Th>
          <Th className="text-right">回数</Th>
          <Th>テレマ担当者</Th>
          <Th className="pr-4">リスト名</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((company) => {
          const last = company.lastCall;
          const address = fullAddress(company);
          return (
            <tr
              key={company.id}
              onClick={(event) => open(event, company.id)}
              className={cn(
                'cursor-pointer transition-colors duration-100 hover:bg-main-soft/60',
                company.mineToday && 'bg-main-soft/40 shadow-[inset_3px_0_0_var(--color-main)]',
              )}
            >
              {picked && setPicked && (
                <Td className="py-2 pl-4">
                  <input
                    type="checkbox"
                    className="check-input"
                    aria-label={`${company.name}を選ぶ`}
                    checked={picked.has(company.id)}
                    onChange={(event) =>
                      setPicked((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(company.id);
                        else next.delete(company.id);
                        return next;
                      })
                    }
                  />
                </Td>
              )}
              <Td className={cn(cell, 'text-ink-sub tabular-nums', !picked && 'pl-4')}>
                {company.telemaIdNo ?? ''}
              </Td>
              <Td className={cn(cell, 'max-w-28 truncate')} title={company.industry ?? undefined}>
                {company.industry}
              </Td>
              <Td className={cell}>
                <span className="flex items-center gap-1.5">
                  <Link
                    to={paths.company(company.id)}
                    className="font-bold text-link underline-offset-2 hover:underline"
                  >
                    {company.name}
                  </Link>
                  {company.mineToday && (
                    <span className="border border-main-line bg-surface px-1 text-[10px] leading-4 font-bold text-main">
                      今日の担当
                    </span>
                  )}
                  {panel && panel.mode !== 'closed' && (
                    <button
                      type="button"
                      title="担当営業の予定を見る"
                      aria-label={`${company.name}の担当営業の予定を見る`}
                      onClick={() => panel.openFor({ id: company.id, name: company.name })}
                      className="flex size-5 shrink-0 cursor-pointer items-center justify-center text-ink-sub hover:bg-main-soft hover:text-main max-md:hidden"
                    >
                      <CalendarDays aria-hidden="true" className="size-3.5" />
                    </button>
                  )}
                </span>
              </Td>
              <Td className={cell}>{company.office}</Td>
              <Td className={cn(cell, 'max-w-36 truncate')} title={company.department ?? undefined}>
                {company.department}
              </Td>
              <Td className={cn(cell, 'tabular-nums')}>{company.phone}</Td>
              <Td className={cn(cell, 'max-w-72 truncate')} title={address || undefined}>
                {address}
              </Td>
              <Td
                className={cn(cell, 'max-w-28 truncate')}
                title={company.nearestStation ?? undefined}
              >
                {company.nearestStation}
              </Td>
              <Td
                className={cn(cell, 'font-bold')}
                title={last ? gradeLabelOf(last.grade) : undefined}
              >
                {last?.grade ?? <span className="font-normal text-ink-sub">未架電</span>}
              </Td>
              <Td className={cn(cell, 'max-w-36 truncate')}>
                {last?.resultCode ? resultLabelOf(last.resultCode) : ''}
              </Td>
              <Td className={cn(cell, 'tabular-nums')}>
                {last ? formatDate(jstDate(new Date(last.calledAt))) : ''}
              </Td>
              <Td className={cn(cell, 'text-right tabular-nums')}>
                {company.callCount > 0 ? company.callCount : ''}
              </Td>
              <Td className={cell}>{last?.telemarketer.name ?? ''}</Td>
              <Td
                className={cn(cell, 'max-w-48 truncate pr-4 text-ink-sub')}
                title={company.listName ?? undefined}
              >
                {company.listName}
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
