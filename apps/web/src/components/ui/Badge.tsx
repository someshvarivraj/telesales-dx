import type { ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'calls' | 'outline';

const toneClass: Record<BadgeTone, string> = {
  neutral: 'bg-column text-ink-sub',
  // Blue, not the orange accent: orange text reads like a warning.
  info: 'bg-schedule-soft text-schedule',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger',
  calls: 'bg-calls-soft text-calls',
  outline: 'border border-line text-ink-sub',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-px text-xs font-medium whitespace-nowrap',
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
