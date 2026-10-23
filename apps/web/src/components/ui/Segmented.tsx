import type { ReactNode } from 'react';
import { cn } from './cn';

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: ReactNode; icon?: ReactNode; hint?: string }[];
  'aria-label': string;
  size?: 'md' | 'sm';
  className?: string;
}

/** A few mutually exclusive choices side by side (日・週・月, 訪問・Web…). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  ...aria
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={aria['aria-label']}
      className={cn('inline-flex border border-line bg-column p-0.5', className)}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={option.hint}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex cursor-pointer items-center justify-center gap-1.5 px-3.5 font-bold whitespace-nowrap transition-[background-color,color,box-shadow] duration-150',
              size === 'sm' ? 'h-7 text-xs' : 'h-9 text-sm',
              on
                ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(30_37_48/0.12),0_0_0_1px_rgb(30_37_48/0.06)]'
                : 'text-ink-sub hover:text-ink',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
