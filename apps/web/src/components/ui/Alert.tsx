import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from './cn';

type Tone = 'error' | 'warning' | 'info' | 'success';

const toneStyle: Record<Tone, { box: string; icon: ReactNode }> = {
  error: {
    box: 'border-danger/40 bg-danger-soft text-ink',
    icon: <CircleAlert aria-hidden="true" className="size-5 shrink-0 text-danger" />,
  },
  warning: {
    box: 'border-warning/50 bg-warning-soft text-ink',
    icon: <TriangleAlert aria-hidden="true" className="size-5 shrink-0 text-warning-ink" />,
  },
  info: {
    box: 'border-main-line border-l-3 border-l-main-focus bg-main-soft text-ink',
    icon: <Info aria-hidden="true" className="size-5 shrink-0 text-schedule" />,
  },
  success: {
    box: 'border-success/30 bg-success-soft text-ink',
    icon: <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-success" />,
  },
};

interface AlertProps {
  tone: Tone;
  children: ReactNode;
  /** What to do about it: a Button / LinkButton, shown at the right edge. */
  action?: ReactNode;
  className?: string;
}

/** Errors are announced immediately (role=alert); other tones politely (role=status). */
export function Alert({ tone, children, action, className }: AlertProps) {
  const style = toneStyle[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 border px-3.5 py-2.5 text-sm',
        Boolean(action) && 'flex-wrap items-center sm:flex-nowrap',
        style.box,
        className,
      )}
    >
      {style.icon}
      <div className="min-w-0 flex-1 pt-px">{children}</div>
      {action && (
        <div className="flex w-full flex-wrap gap-2 pl-7.5 sm:w-auto sm:shrink-0 sm:pl-0">
          {action}
        </div>
      )}
    </div>
  );
}
