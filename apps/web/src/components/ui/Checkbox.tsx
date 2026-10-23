import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from './cn';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  ref?: Ref<HTMLInputElement>;
  label: ReactNode;
  /** A second, quieter line under the label. */
  description?: ReactNode;
  type?: 'checkbox' | 'radio';
}

/**
 * Checkbox or radio with a large touch target (44px). The box is drawn by the app
 * (.check-input) so it matches the inputs instead of the browser's own control.
 */
export function Checkbox({
  label,
  description,
  className,
  type = 'checkbox',
  ...rest
}: CheckboxProps) {
  return (
    <label
      className={cn(
        'group inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-ink',
        Boolean(description) && 'items-start py-2',
        rest.disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <input
        type={type}
        className={cn(
          'check-input',
          type === 'radio' && 'check-radio',
          Boolean(description) && 'mt-0.5',
        )}
        {...rest}
      />
      <span className="flex flex-col">
        <span>{label}</span>
        {description && <span className="text-xs text-ink-sub">{description}</span>}
      </span>
    </label>
  );
}
