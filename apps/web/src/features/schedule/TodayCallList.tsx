import type { CompanyListItem } from '@telesales/shared';
import { ChevronLeft, ChevronRight, ExternalLink, ListChecks, Phone, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { cn } from '@/components/ui/cn';
import { useCompanySearch, useFindRep } from '@/features/calls/api';
import { GradeBadge } from '@/features/calls/CallBadges';

const FOLD_STORE = 'today-list-folded';

function storedFolded() {
  try {
    return window.localStorage.getItem(FOLD_STORE) === '1';
  } catch {
    return false;
  }
}

/**
 * Today's call list beside the sales calendar (request 11/17): a テレマ's 予定 screen shows the
 * companies allocated to them today and the reps' schedules side by side. No big filters here;
 * the full call list (架電対象) stays the master. Picking a company shows its 担当営業's calendar.
 */
export function TodayCallList({ onRep }: { onRep: (repId: string) => void }) {
  const [folded, setFolded] = useState(storedFolded);
  const [needle, setNeedle] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const today = useCompanySearch({
    assignedToMe: true,
    callTargetsOnly: true,
    page: 1,
    pageSize: 200,
  });
  const find = useFindRep();

  const fold = (next: boolean) => {
    setFolded(next);
    try {
      window.localStorage.setItem(FOLD_STORE, next ? '1' : '0');
    } catch {
      // Not remembered in private windows.
    }
  };

  const pick = (company: CompanyListItem) => {
    setPicked(company.id);
    find.mutate(
      { companyId: company.id },
      { onSuccess: (suggestion) => suggestion.rep && onRep(suggestion.rep.id) },
    );
  };

  if (folded) {
    return (
      <button
        type="button"
        onClick={() => fold(false)}
        title="今日の架電リストを開く"
        className="sticky top-[3.25rem] flex h-48 w-9 cursor-pointer flex-col items-center gap-2 border border-line bg-surface py-3 text-xs font-bold text-ink-sub shadow-(--shadow-card) hover:text-main"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        <span className="[writing-mode:vertical-rl]">今日の架電リスト</span>
      </button>
    );
  }

  const items = (today.data?.items ?? []).filter(
    (item) =>
      !needle.trim() ||
      [item.name, item.phone, item.prefecture, item.city]
        .filter(Boolean)
        .some((text) => (text ?? '').includes(needle.trim())),
  );
  const suggestion = find.data;

  return (
    <aside
      aria-label="今日の架電リスト"
      className="sticky top-[3.25rem] flex h-[calc(100dvh-4.5rem)] w-80 flex-col border border-line bg-surface shadow-(--shadow-card)"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-line bg-column px-3 py-2">
        <ListChecks aria-hidden="true" className="size-4 text-main" />
        <h2 className="text-sm font-bold">今日の架電リスト</h2>
        <span className="text-xs text-ink-sub tabular-nums">{today.data?.total ?? 0}件</span>
        <button
          type="button"
          onClick={() => fold(true)}
          aria-label="今日の架電リストをたたむ"
          title="たたむ"
          className="ml-auto flex size-7 cursor-pointer items-center justify-center text-ink-sub hover:bg-hover hover:text-ink"
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </header>
      <label className="flex shrink-0 items-center gap-2 border-b border-line px-3">
        <Search aria-hidden="true" className="size-4 text-ink-sub" />
        <input
          value={needle}
          onChange={(event) => setNeedle(event.target.value)}
          placeholder="会社名・電話・地域で探す"
          aria-label="今日の架電リストを探す"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {today.isPending && <li className="px-3 py-4 text-xs text-ink-sub">読み込み中…</li>}
        {!today.isPending && items.length === 0 && (
          <li className="px-3 py-6 text-center text-xs leading-relaxed text-ink-sub">
            {needle ? '見つかりません。' : '今日割り振られた企業はまだありません。'}
            <br />
            <Link to={paths.calls} className="font-bold text-link hover:underline">
              架電対象から探す
            </Link>
          </li>
        )}
        {items.map((item) => {
          const active = picked === item.id;
          return (
            <li key={item.id} className="border-b border-line last:border-b-0">
              <button
                type="button"
                onClick={() => pick(item)}
                className={cn(
                  'flex w-full cursor-pointer flex-col gap-0.5 px-3 py-2 text-left hover:bg-hover',
                  active && 'bg-main-soft hover:bg-main-soft',
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{item.name}</span>
                  {item.lastCall ? (
                    <GradeBadge grade={item.lastCall.grade} />
                  ) : (
                    <span className="shrink-0 border border-dashed border-line-strong px-1 text-[10px] text-ink-sub">
                      未架電
                    </span>
                  )}
                </span>
                <span className="truncate text-[11px] text-ink-sub">
                  {[item.prefecture, item.city].filter(Boolean).join('')}
                  {item.office && `・${item.office}`}
                </span>
              </button>
              {active && (
                <div className="flex flex-col gap-1.5 bg-main-soft px-3 pb-2.5 text-xs">
                  {item.phone && (
                    <a
                      href={`tel:${item.phone}`}
                      className="flex w-fit items-center gap-1.5 font-bold text-ink tabular-nums hover:text-main"
                    >
                      <Phone aria-hidden="true" className="size-3.5" />
                      {item.phone}
                    </a>
                  )}
                  <span className="text-ink-sub">
                    {find.isPending
                      ? '担当営業を探しています…'
                      : suggestion?.rep
                        ? `担当営業：${suggestion.rep.name}（右の予定に表示中）`
                        : '営業担当表に合う行がありません。右で営業を選んでください。'}
                  </span>
                  <Link
                    to={paths.company(item.id)}
                    className="flex w-fit items-center gap-1 font-bold text-link hover:underline"
                  >
                    企業ページで架電結果を入力
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
