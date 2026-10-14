import type { ReactNode } from 'react';

export function EmptyState({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-ink-sub">
      {icon && <div className="text-ink-disabled">{icon}</div>}
      {children}
    </div>
  );
}
