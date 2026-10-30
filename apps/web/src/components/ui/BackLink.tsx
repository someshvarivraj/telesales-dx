import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

/**
 * The way back, shown as a normal button in its own row above the page title
 * (feedback 10/27 and 10/30: the small text link above the title was missed).
 * Pass `to` for a fixed page, or `onClick` to go back in the history.
 */
const backClass =
  'inline-flex h-10 items-center gap-2 border border-line-strong bg-surface px-4 text-sm font-bold text-ink shadow-(--shadow-card) transition-colors duration-150 hover:border-main-line hover:bg-main-soft active:translate-y-px';

export function BackLink({
  to,
  onClick,
  children,
}: {
  to?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const content = (
    <>
      <ArrowLeft aria-hidden="true" className="size-4" />
      {children}
    </>
  );
  if (to !== undefined) {
    return (
      <Link to={to} className={backClass}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`${backClass} cursor-pointer`}>
      {content}
    </button>
  );
}

/**
 * The same way back at the end of the page, where people look once they are done.
 */
export function BackBar({ to, children }: { to: string; children: ReactNode }) {
  return (
    <div className="mt-8 flex border-t border-line pt-5">
      <BackLink to={to}>{children}</BackLink>
    </div>
  );
}
