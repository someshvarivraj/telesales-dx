import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  /** Small line above the title, e.g. the module name. */
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ title, eyebrow, actions, children }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="mb-0.5 text-xs font-medium text-ink-sub">{eyebrow}</p>}
          <h1 className="text-xl font-bold break-words">{title}</h1>
        </div>
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
