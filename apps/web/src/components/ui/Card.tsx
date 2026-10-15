import type { ReactNode } from 'react';
import { cn } from './cn';

interface CardProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Remove the inner padding, e.g. for tables that run edge to edge. */
  flush?: boolean;
}

export function Card({ title, actions, children, className, flush = false }: CardProps) {
  return (
    <section className={cn('border border-line bg-surface shadow-(--shadow-card)', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          {title && <h2 className="text-base font-bold">{title}</h2>}
          {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
  );
}
