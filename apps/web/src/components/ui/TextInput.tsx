import { type InputHTMLAttributes, type Ref, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { ja } from '@/i18n/ja';
import { cn } from './cn';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

export const inputClass = cn(
  'h-11 w-full border border-line-strong bg-surface px-3 text-base text-ink',
  'placeholder:text-ink-disabled transition-colors duration-150',
  'hover:border-main-line focus:border-main-focus focus:outline-none focus:ring-3 focus:ring-main-focus/20',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/25',
  'disabled:bg-column disabled:text-ink-disabled',
);

export function TextInput({ className, ...rest }: TextInputProps) {
  return <input className={cn(inputClass, className)} {...rest} />;
}

/** Password input with a show/hide toggle. Paste and password managers stay allowed. */
export function PasswordInput({ className, ...rest }: Omit<TextInputProps, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        className={cn(inputClass, 'pr-12', className)}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? ja.auth.hidePassword : ja.auth.showPassword}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-ink-sub transition-colors hover:text-ink"
      >
        {visible ? (
          <EyeOff aria-hidden="true" className="size-5" />
        ) : (
          <Eye aria-hidden="true" className="size-5" />
        )}
      </button>
    </div>
  );
}
