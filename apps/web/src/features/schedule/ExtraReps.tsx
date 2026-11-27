import { Role } from '@telesales/shared';
import { Plus, X } from 'lucide-react';
import { useCallback, useRef } from 'react';
import { PopoverPanel, usePopover } from '@/components/ui/Popover';
import { usePeople } from '@/features/reference/useReference';
import { AttendeePicker } from './AttendeePicker';
import { Avatar } from './calendar/Avatar';
import { personColor } from './calendar/people';

/**
 * 「＋ 営業を追加」 on the booking form (request 11/27): more sales reps for the same meeting.
 * They join as 同席者, get the N9 notice, and their day is shown beside the rep's so a time
 * that suits everyone can be picked.
 */
export function ExtraReps({
  repId,
  value,
  onChange,
  disabled = false,
}: {
  repId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const people = usePeople();
  const sales = usePeople(Role.Sales);
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const onClose = useCallback(() => undefined, []);
  const popover = usePopover(anchor, panel, { width: 340, height: 320, onClose });
  const order = (people.data ?? []).map((person) => person.id);
  const chosen = value
    .filter((id) => id !== repId)
    .map((id) => (sales.data ?? []).find((person) => person.id === id))
    .filter((person) => person !== undefined);

  if (!repId) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[13px] font-bold">
        ほかの営業
        <span className="ml-1.5 text-xs font-normal text-ink-sub">
          同じ打ち合わせに一緒に行く人（同席）
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {chosen.map((person) => (
          <span
            key={person.id}
            className="flex h-9 items-center gap-1.5 border border-success/50 bg-success-soft pr-1 pl-1 text-sm font-bold"
          >
            <Avatar size="sm" name={person.name} color={personColor(person.id, order)} />
            {person.name}
            <button
              type="button"
              disabled={disabled}
              aria-label={`${person.name}を外す`}
              title="外す"
              onClick={() => onChange(value.filter((id) => id !== person.id))}
              className="flex size-7 cursor-pointer items-center justify-center text-ink-sub hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </span>
        ))}
        <button
          ref={anchor}
          type="button"
          disabled={disabled}
          aria-expanded={popover.open}
          aria-haspopup="dialog"
          onClick={() => (popover.open ? popover.hide() : popover.show())}
          className="flex h-9 cursor-pointer items-center gap-1.5 border border-dashed border-main-line px-3 text-sm font-bold text-main transition-colors hover:border-main hover:bg-main-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus aria-hidden="true" className="size-4" />
          営業を追加
        </button>
      </div>
      <PopoverPanel
        state={popover}
        panelRef={panel}
        width={340}
        label="一緒に行く営業"
        className="p-3"
      >
        <p className="mb-2 text-xs text-ink-sub">押すと追加・もう一度押すと外れます</p>
        <AttendeePicker ownerId={repId} value={value} onChange={onChange} tall />
      </PopoverPanel>
    </div>
  );
}
