import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** The way back, above the page title: an arrow and the page it returns to. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-8 items-center gap-1 text-sm font-bold text-link hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {children}
    </Link>
  );
}

/**
 * The same way back as a normal button at the end of the page, where people look
 * once they are done (feedback from the 10/27 test: the small top link was missed).
 */
export function BackBar({ to, children }: { to: string; children: ReactNode }) {
  return (
    <div className="mt-8 flex border-t border-line pt-5">
      <Link
        to={to}
        className="inline-flex h-11 items-center gap-2 border border-line-strong bg-surface px-5 text-sm font-bold text-ink hover:bg-hover"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {children}
      </Link>
    </div>
  );
}
