import type { ReactNode } from 'react';
import { cn } from './cn';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** On/off setting that applies at once (終日, 仮予定…): a track and a sliding knob. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: SwitchProps) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-3 text-sm',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-5 w-9 shrink-0 cursor-pointer transition-colors duration-200',
          checked ? 'bg-main' : 'bg-line-strong',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-0.5 left-0.5 size-4 bg-surface shadow-sm transition-transform duration-200 ease-(--ease-out-soft)',
            checked && 'translate-x-4',
          )}
        />
      </button>
      <span className="flex flex-col">
        <span className="text-ink">{label}</span>
        {description && <span className="text-xs text-ink-sub">{description}</span>}
      </span>
    </label>
  );
}
