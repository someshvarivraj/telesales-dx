import type { UserRef } from '@telesales/shared';
import { ChevronDown, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useCallback, useRef } from 'react';
import { PopoverPanel, usePopover } from '@/components/ui/Popover';
import { MemberPicker, type SavedGroup } from './MemberPicker';

export const PAGE_SIZE = 10;

interface MemberMenuProps {
  people: UserRef[];
  chosen: string[];
  meId: string;
  onChange: (ids: string[]) => void;
  groups: SavedGroup[];
  onGroups: (groups: SavedGroup[]) => void;
  /** How many people the calendar shows in all, and which page of 10 is on screen. */
  shown: number;
  page: number;
  onPage: (page: number) => void;
  /** Month and list show everyone chosen: no paging there. */
  paging?: boolean;
}

/**
 * The calendar's corner: who is shown (opens the member picker) and paging through them
 * ten at a time, so the grid always fits the screen however big the team is.
 */
export function MemberMenu({
  people,
  chosen,
  meId,
  onChange,
  groups,
  onGroups,
  shown,
  page,
  onPage,
  paging = true,
}: MemberMenuProps) {
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const onClose = useCallback(() => undefined, []);
  const popover = usePopover(anchor, panel, { width: 320, height: 420, onClose });
  const pages = Math.max(1, Math.ceil(shown / PAGE_SIZE));
  const first = page * PAGE_SIZE + 1;
  const last = Math.min(shown, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex w-full flex-col gap-1">
      <button
        ref={anchor}
        type="button"
        aria-expanded={popover.open}
        aria-haspopup="dialog"
        onClick={() => (popover.open ? popover.hide() : popover.show())}
        className="flex h-8 w-full cursor-pointer items-center gap-1.5 border border-line-strong bg-surface px-2 text-left text-xs font-bold text-ink transition-colors hover:border-main-line hover:bg-main-soft"
      >
        <Users aria-hidden="true" className="size-3.5 shrink-0 text-ink-sub" />
        <span className="min-w-0 flex-1 truncate">
          {chosen.length ? `メンバー ${shown}人` : `全員 ${shown}人`}
        </span>
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-ink-sub" />
      </button>
      {paging && pages > 1 && (
        <div className="flex items-center gap-1 text-[11px] text-ink-sub">
          <span className="flex-1 tabular-nums">
            {first}–{last} / {shown}人
          </span>
          <button
            type="button"
            aria-label="前の10人"
            disabled={page === 0}
            onClick={() => onPage(page - 1)}
            className="flex size-6 cursor-pointer items-center justify-center border border-line bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft aria-hidden="true" className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="次の10人"
            disabled={page >= pages - 1}
            onClick={() => onPage(page + 1)}
            className="flex size-6 cursor-pointer items-center justify-center border border-line bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      )}
      <PopoverPanel state={popover} panelRef={panel} width={320} label="メンバー" className="p-3">
        <MemberPicker
          people={people}
          chosen={chosen}
          meId={meId}
          onChange={(ids) => {
            onChange(ids);
            onPage(0);
          }}
          groups={groups}
          onGroups={onGroups}
        />
      </PopoverPanel>
    </div>
  );
}
