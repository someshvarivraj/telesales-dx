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
}

/**
 * 同席者: other sales reps joining (spec §6), picked as toggle chips. Used by 予定を追加 and by
 * 自分で取ったアポの登録 (11/13).
 */
export function AttendeePicker({ ownerId, value, onChange }: AttendeePickerProps) {
  const people = usePeople();
  const sales = usePeople(Role.Sales);
  const others = (sales.data ?? []).filter((person) => person.id !== ownerId);
  const order = (people.data ?? []).map((person) => person.id);
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div
      className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto"
      role="group"
      aria-label="同席者"
    >
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
