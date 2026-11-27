import { Role } from '@telesales/shared';
import { cn } from '@/components/ui/cn';
import { usePeople } from '@/features/reference/useReference';
import { Avatar } from './calendar/Avatar';
import { personColor } from './calendar/people';

interface AttendeePickerProps {
  /** The plan's owner (or the appointment's rep): not offered as an attendee. */
  ownerId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  /** In a pop-up list: more rows before it scrolls. */
  tall?: boolean;
}

/**
 * 同席者: other sales reps joining (spec §6), picked as toggle chips. Used by 予定を追加 and by
 * 自分で取ったアポの登録 (11/13).
 */
export function AttendeePicker({ ownerId, value, onChange, tall = false }: AttendeePickerProps) {
  const people = usePeople();
  const sales = usePeople(Role.Sales);
  const others = (sales.data ?? []).filter((person) => person.id !== ownerId);
  const order = (people.data ?? []).map((person) => person.id);
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  // 「全員」 (11/27): a meeting for every sales rep at once.
  const allOn = others.length > 0 && others.every((person) => value.includes(person.id));
  const toggleAll = () =>
    onChange(
      allOn
        ? value.filter((id) => !others.some((person) => person.id === id))
        : [...new Set([...value, ...others.map((person) => person.id)])],
    );

  return (
    <div
      className={cn('flex flex-wrap gap-1.5 overflow-y-auto', tall ? 'max-h-64' : 'max-h-32')}
      role="group"
      aria-label="同席者"
    >
      {others.length > 1 && (
        <button
          type="button"
          aria-pressed={allOn}
          onClick={toggleAll}
          className={cn(
            'flex h-8 cursor-pointer items-center border px-3 text-sm font-bold transition-colors',
            allOn
              ? 'border-main bg-main text-white'
              : 'border-main-line text-main hover:bg-main-soft',
          )}
        >
          {allOn ? '全員を外す' : `全員（${others.length}人）`}
        </button>
      )}
      {others.map((person) => {
        const on = value.includes(person.id);
        return (
          <button
            key={person.id}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(person.id)}
            className={cn(
              'flex h-8 cursor-pointer items-center gap-1.5 border pr-3 pl-1 text-sm transition-colors',
              on
                ? 'border-success/50 bg-success-soft font-bold text-ink'
                : 'border-line text-ink-sub hover:border-line-strong hover:text-ink',
            )}
          >
            <Avatar
              size="sm"
              name={person.name}
              color={personColor(person.id, order)}
              className={cn(!on && 'opacity-50')}
            />
            {person.name}
          </button>
        );
      })}
      {others.length === 0 && <p className="text-sm text-ink-sub">ほかの営業さんがいません。</p>}
    </div>
  );
}
