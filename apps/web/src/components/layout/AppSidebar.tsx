import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { paths } from '@/app/paths';
import { cn } from '@/components/ui/cn';
import { RoleBadges } from '@/components/ui/RoleBadge';
import { useCurrentUser, useLogout } from '@/features/auth/hooks/useSession';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { LanguageSwitch } from '@/i18n/english/LanguageSwitch';
import { ja } from '@/i18n/ja';
import { BrandMark } from './BrandMark';
import { visibleNav } from './navItems';

const STORAGE_KEY = 'telesales.sidebar';

function readFolded(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'closed';
  } catch {
    return false;
  }
}

/**
 * The left menu on tablets and wider, as on the skill sheet system: logo,
 * the screens this user can open, notices, and the user at the foot. « folds it
 * to a strip of icons; the choice is remembered in this browser.
 */
export function AppSidebar() {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const items = visibleNav(user.permissions);
  const [folded, setFolded] = useState(readFolded);

  useEffect(() => {
    const root = document.documentElement;
    if (folded) root.dataset.sidebar = 'closed';
    else delete root.dataset.sidebar;
    try {
      localStorage.setItem(STORAGE_KEY, folded ? 'closed' : 'open');
    } catch {
      // Storage can be unavailable (private window); the menu just starts open.
    }
    return () => {
      delete root.dataset.sidebar;
    };
  }, [folded]);

  const handleLogout = () => {
    logout.mutate(undefined, { onSettled: () => navigate(paths.login, { replace: true }) });
  };

  return (
    <aside className="sidebar fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-surface max-md:hidden">
      <div className="flex items-center gap-1 px-3 pt-4 pb-3">
        <Link
          to={paths.home}
          className="sidebar-full flex min-w-0 flex-1 items-center gap-2.5 px-1 text-sm leading-snug font-bold text-ink"
        >
          <BrandMark />
          <span className="min-w-0">{ja.app.name}</span>
        </Link>
        <button
          type="button"
          onClick={() => setFolded((value) => !value)}
          aria-label={folded ? 'メニューを開く' : 'メニューを閉じる'}
          aria-expanded={!folded}
          className={cn(
            'flex size-9 shrink-0 cursor-pointer items-center justify-center text-ink-sub hover:bg-hover hover:text-ink',
            folded && 'mx-auto',
          )}
        >
          {folded ? (
            <PanelLeftOpen aria-hidden="true" className="size-4.5" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="size-4.5" />
          )}
        </button>
      </div>

      <nav
        aria-label="メインメニュー"
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-1"
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={folded ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                'nav-link flex h-10 items-center gap-3 px-3 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-main-soft text-main shadow-[inset_3px_0_0_var(--color-main)]'
                  : 'text-ink-sub hover:bg-hover hover:text-ink',
              )
            }
          >
            <item.icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} />
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
        <div className="mt-1 border-t border-line pt-1">
          <NotificationBell variant="menu" />
        </div>
      </nav>

      <div className="border-t border-line px-4 py-3.5">
        <div className="sidebar-full">
          <LanguageSwitch className="mb-3" />
          <p className="truncate text-sm font-bold text-ink">{user.name}</p>
          <div className="mt-1">
            <RoleBadges roles={user.roles} />
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logout.isPending}
            className="mt-3 flex cursor-pointer items-center gap-1.5 text-sm font-medium text-ink-sub hover:text-main disabled:opacity-45"
          >
            <LogOut aria-hidden="true" className="size-4" />
            {ja.auth.logout}
          </button>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={logout.isPending}
          aria-label={ja.auth.logout}
          title={ja.auth.logout}
          className="sidebar-compact size-9 w-full cursor-pointer items-center justify-center text-ink-sub hover:bg-hover hover:text-main"
        >
          <LogOut aria-hidden="true" className="size-4.5" />
        </button>
      </div>
    </aside>
  );
}
