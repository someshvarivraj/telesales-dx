import { isRole, Role } from '@telesales/shared';
import { LogOut } from 'lucide-react';
import { useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { paths } from '@/app/paths';
import { MoraBot } from '@/components/brand/MoraBot';
import { cn } from '@/components/ui/cn';
import { useCurrentUser, useLogout } from '@/features/auth/hooks/useSession';
import { FeedbackButton } from '@/features/feedback/FeedbackButton';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { ja } from '@/i18n/ja';
import { type NavItem, visibleNav } from './navItems';

/** Avatar colour follows the person's main role (same tones as the role badges). */
const AVATAR_TONE: Record<Role, string> = {
  [Role.Admin]: 'bg-role-admin-soft text-role-admin',
  [Role.TelemaLead]: 'bg-role-telema-soft text-role-telema',
  [Role.Telema]: 'bg-role-telema-soft text-role-telema',
  [Role.Sales]: 'bg-role-sales-soft text-role-sales',
  [Role.Viewer]: 'bg-role-viewer-soft text-role-viewer',
};

/** First characters of the name: 「田中 花子」→「田中」, 「V Someshvari」→「VS」. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (/^[A-Za-z]/.test(name)) {
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
  return (parts[0] ?? name).slice(0, 2);
}

/**
 * The left menu on tablets and wider, always the slim Teams-like rail (request 11/17: no wide
 * menu, so the screen's content gets the room). MoraBot and the app's name at the top, the
 * screens as icons with short labels, and feedback, the signed-in person and log out at the foot.
 * Language and theme are in the top bar.
 */
export function AppSidebar() {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const items = visibleNav(user.permissions);
  const mainRole = user.roles.find(isRole) ?? Role.Viewer;

  // The rail styles hang on html[data-sidebar='closed'].
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.sidebar = 'closed';
    return () => {
      delete root.dataset.sidebar;
    };
  }, []);

  const handleLogout = () => {
    logout.mutate(undefined, { onSettled: () => navigate(paths.login, { replace: true }) });
  };

  const sections = (['main', 'work', 'settings'] as const)
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className="sidebar fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-column max-md:hidden">
      <Link
        to={paths.home}
        title={`${ja.app.name}（${ja.app.company}）`}
        className="flex shrink-0 flex-col items-center gap-0.5 border-b border-line px-1 pt-2 pb-2 hover:bg-line/60"
      >
        <MoraBot mood="happy" size={46} title="" />
        <span className="text-center text-[9.5px] leading-tight font-bold text-ink">
          テレマ
          <br />
          営業DX
        </span>
      </Link>

      <nav aria-label="メインメニュー" className="flex flex-1 flex-col overflow-y-auto px-1.5 py-2">
        {sections.map((section) => (
          <div key={section.group} className="mb-2 flex flex-col gap-0.5">
            {section.items.map((item) => (
              <SideLink key={item.to} item={item} />
            ))}
            {section.group === 'main' && <NotificationBell variant="menu" />}
          </div>
        ))}
      </nav>

      <div className="flex shrink-0 flex-col items-center gap-1 border-t border-line px-1.5 py-2">
        <FeedbackButton variant="menu" folded />
        <span
          title={`${user.name}（${user.roles
            .filter(isRole)
            .map((role) => ja.role[role])
            .join('・')}）`}
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full! text-xs font-bold',
            AVATAR_TONE[mainRole],
          )}
        >
          {initialsOf(user.name)}
        </span>
        <button
          type="button"
          onClick={handleLogout}
          disabled={logout.isPending}
          aria-label={ja.auth.logout}
          title={ja.auth.logout}
          className="flex h-9 w-full cursor-pointer items-center justify-center text-ink-sub hover:bg-line/60 hover:text-danger disabled:opacity-45"
        >
          <LogOut aria-hidden="true" className="size-4.5" />
        </button>
      </div>
    </aside>
  );
}

function SideLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={item.sideLabel}
      className={({ isActive }) =>
        cn(
          'nav-link relative flex h-9 items-center gap-3 px-2.5 text-[13.5px] transition-colors',
          isActive
            ? 'bg-surface font-bold text-ink shadow-(--shadow-card) ring-1 ring-line before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:bg-main'
            : 'font-medium text-ink-sub hover:bg-line/60 hover:text-ink',
        )
      }
    >
      <item.icon aria-hidden="true" className="nav-icon size-[18px] shrink-0" strokeWidth={1.8} />
      <span className="nav-label truncate">{item.sideLabel}</span>
      {/* Folded: a Teams-like rail, a short label under each icon (11/17). */}
      <span className="nav-rail-label">{item.label}</span>
    </NavLink>
  );
}
