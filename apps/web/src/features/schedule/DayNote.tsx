import { DAY_NOTE_MAX, type DayNoteDto } from '@telesales/shared';
import { StickyNote } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/components/ui/cn';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { useSaveDayNote } from './api';

interface DayNoteProps {
  userId: string;
  date: string;
  note: DayNoteDto | undefined;
  /** The person whose day it is, or an admin. */
  editable: boolean;
  /** Who the day belongs to, for screen readers (「田中さん 11/18」). */
  label: string;
}

/**
 * A note in a day's header (11/18): typed straight in, like writing on a desk calendar.
 * Saved when the field is left or Enter is pressed; Esc puts back what was there. Everyone
 * viewing the schedule sees it; only the person (or an admin) can write it.
 */
export function DayNote({ userId, date, note, editable, label }: DayNoteProps) {
  const saved = note?.text ?? '';
  const [text, setText] = useState(saved);
  const [shownSaved, setShownSaved] = useState(saved);
  const save = useSaveDayNote();
  // Someone else changed it (or another day is shown): follow the saved text.
  if (shownSaved !== saved) {
    setShownSaved(saved);
    setText(saved);
  }
  const title = note ? `${note.text}（${note.updatedBy.name}）` : undefined;

  if (!editable) {
    if (!saved) return null;
    return (
      <p
        className="mt-1 flex min-w-0 items-start gap-1 text-[11px] leading-4 text-ink-sub"
        title={title}
      >
        <StickyNote aria-hidden="true" className="mt-px size-3 shrink-0" />
        <span className="line-clamp-2 break-all">{saved}</span>
      </p>
    );
  }

  const commit = () => {
    const next = text.replace(/\s+/g, ' ').trim();
    if (next === saved) {
      setText(saved);
      return;
    }
    save.mutate({ userId, date, text: next });
  };

  return (
    <label className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-ink-sub" title={title}>
      <StickyNote aria-hidden="true" className="size-3 shrink-0" />
      <input
        value={text}
        maxLength={DAY_NOTE_MAX}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setText(saved);
            event.currentTarget.blur();
          }
        }}
        placeholder="メモを入力"
        aria-label={`${label}のメモ`}
        aria-invalid={save.isError || undefined}
        title={save.isError ? errorMessageOf(save.error) : title}
        className={cn(
          'h-5 w-full min-w-0 border-b border-dashed border-transparent bg-transparent px-0.5 text-[11px] text-ink',
          'placeholder:text-ink-disabled hover:border-line-strong focus:border-main focus:bg-surface focus:outline-none',
          save.isPending && 'opacity-60',
          save.isError && 'border-danger',
        )}
      />
    </label>
  );
}
