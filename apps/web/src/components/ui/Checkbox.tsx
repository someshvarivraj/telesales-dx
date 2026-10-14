import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from './cn';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  ref?: Ref<HTMLInputElement>;
  label: ReactNode;
  type?: 'checkbox' | 'radio';
}

/** Checkbox or radio with a large touch target (44px). */
export function Checkbox({ label, className, type = 'checkbox', ...rest }: CheckboxProps) {
  return (
    <label
      className={cn(
        'inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-ink',
        rest.disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <input type={type} className="size-[18px] shrink-0 cursor-pointer accent-main" {...rest} />
      <span>{label}</span>
    </label>
  );
}
