import type { UserRef } from '@telesales/shared';
import { BookmarkPlus, Search, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/components/ui/cn';
import { Avatar } from './Avatar';
import { personColor } from './people';

export interface SavedGroup {
  name: string;
  ids: string[];
}

interface MemberPickerProps {
  people: UserRef[];
  /** Shown people; empty = everyone. */
  chosen: string[];
  meId: string;
  onChange: (ids: string[]) => void;
  groups: SavedGroup[];
  onGroups: (groups: SavedGroup[]) => void;
}

const SHOWN_CHOSEN = 8;
const SHOWN_RESULTS = 30;

/**
 * Who the calendar shows, built for a hundred people or more: search by name, saved
 * groups (マイグループ) and only the chosen people listed — never the whole staff at once.
 */
export function MemberPicker({
  people,
  chosen,
  meId,
  onChange,
  groups,
  onGroups,
}: MemberPickerProps) {
  const [query, setQuery] = useState('');
  const [naming, setNaming] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const order = people.map((person) => person.id);
  const everyone = chosen.length === 0;
  const chosenPeople = everyone ? [] : people.filter((person) => chosen.includes(person.id));
  const needle = query.trim().toLowerCase();
  const results = needle
    ? people.filter((person) =>
        person.name.toLowerCase().replace(/\s/g, '').includes(needle.replace(/\s/g, '')),
      )
    : [];
  const isMe = people.some((person) => person.id === meId);

  const toggle = (id: string) => {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
    onChange(next.length === people.length ? [] : next);
  };
  const sameAs = (ids: string[]) =>
    !everyone && ids.length === chosen.length && ids.every((id) => chosen.includes(id));

  const preset = (label: string, on: boolean, onClick: () => void, count?: number) => (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'flex h-7 shrink-0 cursor-pointer items-center gap-1 border px-2 text-xs font-bold transition-colors',
        on ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-sub hover:text-ink',
      )}
    >
      {label}
      {count !== undefined && <span className="font-normal opacity-75">{count}</span>}
    </button>
  );

  return (
    <div className="flex flex-col gap-2.5 select-none">
      <div className="flex flex-wrap gap-1.5">
        {preset('全員', everyone, () => onChange([]), people.length)}
        {isMe && preset('自分', sameAs([meId]), () => onChange([meId]))}
        {groups.map((group) => (
          <span key={group.name} className="group/g relative flex">
            {preset(
              group.name,
              sameAs(group.ids),
              () => onChange(group.ids.filter((id) => order.includes(id))),
              group.ids.length,
            )}
            <button
              type="button"
              aria-label={`${group.name}を削除`}
              onClick={() => onGroups(groups.filter((g) => g.name !== group.name))}
              className="absolute -top-1.5 -right-1.5 hidden size-4 cursor-pointer items-center justify-center bg-ink text-white group-hover/g:flex"
            >
              <X aria-hidden="true" className="size-2.5" />
            </button>
          </span>
        ))}
      </div>

      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-sub"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && results[0]) {
              event.preventDefault();
              if (!chosen.includes(results[0].id)) toggle(results[0].id);
              setQuery('');
            }
            if (event.key === 'Escape') setQuery('');
          }}
          placeholder={`名前で探す（${people.length}人）`}
          aria-label="メンバーを名前で探す"
          className="h-9 w-full border border-line-strong bg-surface pr-2 pl-8 text-sm placeholder:text-ink-disabled focus:border-main-focus focus:ring-3 focus:ring-main-focus/20 focus:outline-none"
        />
      </div>

      {needle ? (
        <ul className="scroll-quiet max-h-72 overflow-y-auto border border-line bg-surface">
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-sub">見つかりません</li>
          )}
          {results.slice(0, SHOWN_RESULTS).map((person) => {
            const on = !everyone && chosen.includes(person.id);
            return (
              <li key={person.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(person.id)}
                  className="flex min-h-9 w-full cursor-pointer items-center gap-2 px-2.5 text-left text-sm hover:bg-hover"
                >
                  <Avatar size="sm" name={person.name} color={personColor(person.id, order)} />
                  <span className="flex-1 truncate">{person.name}</span>
                  <span className={cn('text-[11px] font-bold', on ? 'text-success' : 'text-link')}>
                    {on ? '表示中' : '＋追加'}
                  </span>
                </button>
              </li>
            );
          })}
          {results.length > SHOWN_RESULTS && (
            <li className="px-3 py-1.5 text-[11px] text-ink-sub">
              ほか{results.length - SHOWN_RESULTS}人。名前をもう少し入れてください。
            </li>
          )}
        </ul>
      ) : everyone ? (
        <p className="border border-dashed border-line px-3 py-2.5 text-xs leading-relaxed text-ink-sub">
          {people.length}人全員を表示中です。名前で探して追加するか、グループを選ぶと絞り込めます。
        </p>
      ) : (
        <div>
          <p className="mb-1 flex items-center px-0.5 text-[11px] font-bold text-ink-sub">
            表示中 {chosenPeople.length}人
            <button
              type="button"
              onClick={() => onChange([])}
              className="ml-auto h-6 cursor-pointer px-1.5 font-bold text-ink-sub transition-colors hover:bg-hover hover:text-ink"
            >
              解除
            </button>
          </p>
          <ul className="flex flex-col">
            {(more ? chosenPeople : chosenPeople.slice(0, SHOWN_CHOSEN)).map((person) => (
              <li key={person.id} className="group flex min-h-8 items-center gap-2 px-0.5">
                <Avatar size="sm" name={person.name} color={personColor(person.id, order)} />
                <span className="flex-1 truncate text-sm">
                  {person.name}
                  {person.id === meId && (
                    <span className="ml-1 text-[11px] text-ink-sub">（自分）</span>
                  )}
                </span>
                <button
                  type="button"
                  aria-label={`${person.name}を外す`}
                  onClick={() => toggle(person.id)}
                  className="flex size-6 cursor-pointer items-center justify-center text-ink-sub opacity-0 group-hover:opacity-100 hover:text-danger focus:opacity-100"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          {chosenPeople.length > SHOWN_CHOSEN && (
            <button
              type="button"
              onClick={() => setMore(!more)}
              className="mt-1 h-7 w-full cursor-pointer px-1.5 text-left text-[11px] font-bold text-ink-sub transition-colors hover:bg-hover hover:text-ink"
            >
              {more ? '閉じる' : `ほか${chosenPeople.length - SHOWN_CHOSEN}人を表示`}
            </button>
          )}
          {naming === null ? (
            !groups.some((group) => sameAs(group.ids)) &&
            chosenPeople.length > 1 && (
              <button
                type="button"
                onClick={() => setNaming('')}
                className="mt-2 flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 border border-dashed border-line-strong text-xs font-bold text-ink-sub hover:border-main-line hover:text-ink"
              >
                <BookmarkPlus aria-hidden="true" className="size-3.5" />
                この{chosenPeople.length}人をグループとして保存
              </button>
            )
          ) : (
            <form
              className="mt-2 flex gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                const name = naming.trim();
                if (!name) return;
                onGroups([...groups.filter((g) => g.name !== name), { name, ids: chosen }]);
                setNaming(null);
              }}
            >
              <input
                autoFocus
                value={naming}
                maxLength={20}
                onChange={(event) => setNaming(event.target.value)}
                placeholder="グループ名（例：関西チーム）"
                aria-label="グループ名"
                className="h-8 min-w-0 flex-1 border border-line-strong px-2 text-xs focus:border-main-focus focus:outline-none"
              />
              <button
                type="submit"
                className="h-8 cursor-pointer bg-main px-2.5 text-xs font-bold text-white"
              >
                保存
              </button>
              <button
                type="button"
                aria-label="やめる"
                onClick={() => setNaming(null)}
                className="flex size-8 cursor-pointer items-center justify-center text-ink-sub hover:text-ink"
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
