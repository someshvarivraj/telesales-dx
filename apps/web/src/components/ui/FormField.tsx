import { type ReactNode, useId } from 'react';
import { ja } from '@/i18n/ja';

export interface FieldControlProps {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
  'aria-required': boolean;
}

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  /** Render prop so the field owns ids/ARIA wiring and the caller owns the control. */
  children: (control: FieldControlProps) => ReactNode;
}

/** Label, 必須 badge, hint and inline error for one control. */
export function FormField({ label, required = false, hint, error, children }: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-baseline gap-1.5 text-[13px] font-bold text-ink">
        {label}
        {required && (
          <span className="text-[11px] font-bold text-danger">{ja.common.required}</span>
        )}
      </label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy,
        'aria-required': required,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-ink-sub">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
