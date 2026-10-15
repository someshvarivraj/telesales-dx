import { LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { paths } from '@/app/paths';
import { useLogout } from '@/features/auth/hooks/useSession';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { LanguageSwitch } from '@/i18n/english/LanguageSwitch';
import { ja } from '@/i18n/ja';
import { BrandMark } from './BrandMark';

/** Phone top bar: logo, notices and log out. The screens are in the bottom tab bar. */
export function AppHeader() {
  const logout = useLogout();
  const navigate = useNavigate();
  const handleLogout = () => {
    logout.mutate(undefined, { onSettled: () => navigate(paths.login, { replace: true }) });
  };
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface md:hidden">
      <div className="flex h-13 items-center gap-2 px-3">
        <Link
          to={paths.home}
          className="flex min-w-0 items-center gap-2 text-sm font-bold text-ink"
        >
          <BrandMark size={26} />
          <span className="truncate">{ja.app.name}</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <LanguageSwitch className="h-9" />
          <NotificationBell />
          <button
            type="button"
            onClick={handleLogout}
            disabled={logout.isPending}
            aria-label={ja.auth.logout}
            className="flex size-10 cursor-pointer items-center justify-center text-ink-sub hover:text-ink"
          >
            <LogOut aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
