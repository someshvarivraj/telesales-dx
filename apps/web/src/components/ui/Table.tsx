import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from './cn';

/**
 * Table that scrolls horizontally inside its container on small screens.
 * `stickyHeader`: from tablets up the table scrolls inside its own area, under a header
 * row that stays put, so the column names are always visible.
 */
export function Table({
  children,
  className,
  stickyHeader = false,
}: {
  children: ReactNode;
  className?: string;
  stickyHeader?: boolean;
}) {
  return (
    <div
      className={cn(
        'overflow-x-auto',
        stickyHeader &&
          'scroll-quiet md:max-h-[calc(100dvh-12rem)] md:overflow-y-auto md:[&_th]:sticky md:[&_th]:top-0 md:[&_th]:z-10',
      )}
    >
      <table className={cn('w-full border-collapse text-sm', className)}>{children}</table>
    </div>
  );
}

export function Th({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'border-b border-line bg-column px-3 py-2.5 text-left shadow-[inset_0_-1px_0_var(--color-line)] text-xs font-bold whitespace-nowrap text-ink-sub',
        className,
      )}
      {...rest}
    />
  );
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-b border-line px-3 py-3 align-top', className)} {...rest} />;
}
