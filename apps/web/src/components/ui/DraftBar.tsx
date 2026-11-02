import { History, RotateCcw } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { Button } from './Button';
import { cn } from './cn';

/**
 * 「前回の入力を戻しました」 (request 11/2): shown when a form was filled in from what was kept
 * after a refresh or a closed window, with a way to start over.
 */
export function DraftNotice({
  restoredAt,
  onReset,
  className,
}: {
  restoredAt: number | null;
  onReset: () => void;
  className?: string;
}) {
  if (restoredAt === null) return null;
  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center gap-2 border border-schedule/30 bg-schedule-soft px-3 py-2 text-sm',
        className,
      )}
    >
      <History className="size-4 shrink-0 text-schedule" aria-hidden="true" />
      <span>{`前回の入力を戻しました（${formatDateTime(new Date(restoredAt).toISOString())}）`}</span>
      <Button size="sm" variant="text" className="ml-auto" onClick={onReset}>
        最初から入力する
      </Button>
    </div>
  );
}

/** 「入力をリセット」: clears what was typed in a form, kept copy included. */
export function ResetButton({
  dirty,
  onReset,
  className,
}: {
  dirty: boolean;
  onReset: () => void;
  className?: string;
}) {
  return (
    <Button
      variant="text"
      className={className}
      disabled={!dirty}
      icon={<RotateCcw className="size-4" aria-hidden="true" />}
      onClick={onReset}
    >
      入力をリセット
    </Button>
  );
}
