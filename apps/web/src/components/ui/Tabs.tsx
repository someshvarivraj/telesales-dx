import { NavLink } from 'react-router';
import { cn } from './cn';

export interface TabItem {
  to: string;
  label: string;
  /** Count shown next to the label, e.g. open requests. */
  count?: number;
  end?: boolean;
}

/** Route-based tabs. Scrolls horizontally on small screens. */
export function Tabs({ items }: { items: readonly TabItem[] }) {
  return (
    <nav className="-mx-4 mb-6 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  '-mb-px flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-bold transition-colors',
                  isActive
                    ? 'border-main text-main'
                    : 'border-transparent text-ink-sub hover:text-ink',
                )
              }
            >
              {item.label}
              {item.count !== undefined && item.count > 0 && (
                <span className="rounded-full bg-danger px-1.5 text-xs leading-5 text-white">
                  {item.count}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
