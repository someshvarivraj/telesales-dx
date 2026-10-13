import { ROLE_HOME_PATH } from '@telesales/shared';
import { LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { paths } from '@/app/paths';
import { Button } from '@/components/ui/Button';
import { RoleBadge } from '@/components/ui/RoleBadge';
import { useCurrentUser, useLogout } from '@/features/auth/hooks/useSession';
import { ja } from '@/i18n/ja';
import { BrandMark } from './BrandMark';

export function AppHeader() {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => navigate(paths.login, { replace: true }),
    });
  };

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link to={ROLE_HOME_PATH[user.role]} className="flex items-center gap-2.5 rounded-md">
          <BrandMark />
          <span className="font-bold tracking-wide text-ink max-sm:hidden">{ja.app.name}</span>
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-3">
          <RoleBadge role={user.role} isTeamLead={user.isTeamLead} />
          <span className="truncate text-sm font-bold text-ink">{user.displayName}</span>
          <Button
            variant="text"
            onClick={handleLogout}
            loading={logout.isPending}
            icon={<LogOut aria-hidden="true" className="size-4" />}
            className="max-sm:px-2.5"
          >
            <span className="max-sm:sr-only">{ja.auth.logout}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
