import { NavLink } from 'react-router';
import { cn } from '@/components/ui/cn';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { visibleNav } from './navItems';

/** Bottom tab bar on phones (sales check plans and appointments while out). */
export function MobileNav() {
  const { permissions } = useCurrentUser();
  const items = visibleNav(permissions).slice(0, 5);
  return (
    <nav
      aria-label="メインメニュー"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul
        className="grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold',
                  isActive ? 'text-main' : 'text-ink-sub',
                )
              }
            >
              <item.icon aria-hidden="true" className="size-5" />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
