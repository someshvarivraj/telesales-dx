import { LogOut } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router';
import { paths } from '@/app/paths';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { RoleBadges } from '@/components/ui/RoleBadge';
import { useCurrentUser, useLogout } from '@/features/auth/hooks/useSession';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { ja } from '@/i18n/ja';
import { BrandMark } from './BrandMark';
import { visibleNav } from './navItems';

export function AppHeader() {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const items = visibleNav(user.permissions);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => navigate(paths.login, { replace: true }),
    });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link to={paths.home} className="flex shrink-0 items-center gap-2.5 rounded-md">
          <BrandMark />
          <span className="font-bold tracking-wide text-ink max-lg:hidden">{ja.app.name}</span>
        </Link>
        <nav aria-label="メインメニュー" className="max-md:hidden">
          <ul className="flex items-center gap-1">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-bold transition-colors',
                      isActive
                        ? 'bg-main-soft text-main'
                        : 'text-ink-sub hover:bg-column hover:text-ink',
                    )
                  }
                >
                  <item.icon aria-hidden="true" className="size-4" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <div className="max-xl:hidden">
            <RoleBadges roles={user.roles} />
          </div>
          <span className="truncate text-sm font-bold text-ink max-sm:hidden">{user.name}</span>
          <NotificationBell />
          <Button
            variant="text"
            onClick={handleLogout}
            loading={logout.isPending}
            icon={<LogOut aria-hidden="true" className="size-4" />}
            className="px-2.5"
            aria-label={ja.auth.logout}
          >
            <span className="max-lg:sr-only">{ja.auth.logout}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
