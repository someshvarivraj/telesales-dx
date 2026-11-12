import {
  type ReactNode,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { cn } from './cn';

/**
 * Table that scrolls sideways inside its container when it is wider than the screen.
 * `stickyHeader`: the page itself scrolls (no second scroll area inside it) and the header
 * row stays at the top of the window, so the column names are always in sight (request
 * 11/12). That needs the table to fit the width; when it does not (a phone), it falls back
 * to sideways scrolling with an ordinary header.
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
  const box = useRef<HTMLDivElement>(null);
  const table = useRef<HTMLTableElement>(null);
  const [fits, setFits] = useState(true);

  useLayoutEffect(() => {
    if (!stickyHeader || !box.current || !table.current) return;
    const outer = box.current;
    const inner = table.current;
    const measure = () => setFits(inner.offsetWidth <= outer.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [stickyHeader]);

  const sticky = stickyHeader && fits;
  return (
    <div
      ref={box}
      className={cn(
        sticky
          ? // Below the phone top bar; at the very top from tablets up.
            '[&_th]:sticky [&_th]:top-13 [&_th]:z-10 md:[&_th]:top-0'
          : 'overflow-x-auto',
      )}
    >
      <table ref={table} className={cn('w-full border-collapse text-sm', className)}>
        {children}
      </table>
    </div>
  );
}

export function Th({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'border-b border-head-line bg-head px-3 py-2.5 text-left text-xs font-bold whitespace-nowrap text-ink shadow-[inset_0_-1px_0_var(--color-head-line)]',
        className,
      )}
      {...rest}
    />
  );
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-b border-line px-3 py-3 align-top', className)} {...rest} />;
}
