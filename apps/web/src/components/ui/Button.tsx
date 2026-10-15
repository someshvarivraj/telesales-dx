import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'danger' | 'text';
type Size = 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Label shown while loading, e.g. 「ログイン中…」. */
  loadingLabel?: string;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary: 'bg-main text-white shadow-[0_1px_2px_rgb(194_65_12/0.25)] hover:bg-main-hover',
  secondary:
    'border border-line-strong bg-surface text-ink hover:border-main-line hover:bg-main-soft hover:text-main',
  danger: 'border border-danger/40 bg-surface text-danger hover:border-danger hover:bg-danger-soft',
  text: 'text-main hover:bg-main-soft',
};

const sizeClass: Record<Size, string> = {
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel,
  icon,
  fullWidth = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 font-medium whitespace-nowrap transition-colors duration-150 active:translate-y-px',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0',
        variantClass[variant],
        sizeClass[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
