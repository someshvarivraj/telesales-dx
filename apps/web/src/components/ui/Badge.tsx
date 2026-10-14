import type { ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'main' | 'success' | 'warning' | 'danger' | 'calls' | 'outline';

const toneClass: Record<BadgeTone, string> = {
  neutral: 'bg-column text-ink-sub',
  main: 'bg-main-soft text-main',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-ink',
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
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap',
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
