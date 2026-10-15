import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const DOT: Record<StatusTone, string> = {
  neutral: 'bg-ink-disabled',
  info: 'bg-schedule',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

/**
 * A state shown as a small coloured dot and plain text, the way issue trackers do it.
 * Only the dot carries colour, so a row with several states stays calm and readable.
 * `secondary` is for follow-up states under the main one (smaller, grey text).
 */
export function StatusLabel({
  tone,
  secondary = false,
  children,
  className,
}: {
  tone: StatusTone;
  secondary?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap',
        secondary ? 'text-xs text-ink-sub' : 'text-sm font-medium text-ink',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full!', DOT[tone])} />
      {children}
    </span>
  );
}

/** A plain fact with an icon, e.g. 「オンライン」: no colour at all. */
export function MetaLabel({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap text-ink-sub">
      <Icon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={1.9} />
      {children}
    </span>
  );
}
