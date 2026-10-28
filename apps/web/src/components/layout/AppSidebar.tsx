import { isRole, Role } from '@telesales/shared';
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { paths } from '@/app/paths';
import { useTheme } from '@/components/brand/theme';
import { cn } from '@/components/ui/cn';
import { Switch } from '@/components/ui/Switch';
import { useCurrentUser, useLogout } from '@/features/auth/hooks/useSession';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { LanguageSwitch } from '@/i18n/english/LanguageSwitch';
import { ja } from '@/i18n/ja';
import { BrandMark } from './BrandMark';
import { type NavItem, visibleNav } from './navItems';

const STORAGE_KEY = 'telesales.sidebar';

const SECTION_LABEL: Record<NavItem['group'], string | null> = {
  main: null,
  work: '業務',
  settings: '設定',
};

/** Avatar colour follows the person's main role (same tones as the role badges). */
const AVATAR_TONE: Record<Role, string> = {
  [Role.Admin]: 'bg-role-admin-soft text-role-admin',
  [Role.TelemaLead]: 'bg-role-telema-soft text-role-telema',
  [Role.Telema]: 'bg-role-telema-soft text-role-telema',
  [Role.Sales]: 'bg-role-sales-soft text-role-sales',
  [Role.Viewer]: 'bg-role-viewer-soft text-role-viewer',
};

function readFolded(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'closed';
  } catch {
    return false;
  }
}

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
 * The left menu on tablets and wider. Brand at the top, the screens grouped by
 * section, and the signed-in person at the foot. The fold button next to the name
 * (under the logo when folded) shrinks it to icons; the choice is remembered in this browser.
 */
export function AppSidebar() {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const items = visibleNav(user.permissions);
  const [folded, setFolded] = useState(readFolded);
  const mainRole = user.roles.find(isRole) ?? Role.Viewer;

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

  const sections = (['main', 'work', 'settings'] as const)
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className="sidebar fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-column max-md:hidden">
      <div
        className={cn(
          'flex shrink-0 border-b border-line',
          folded ? 'flex-col items-center gap-1 py-3' : 'h-16 items-center gap-1 pr-2',
        )}
      >
        <Link
          to={paths.home}
          title={folded ? ja.app.name : undefined}
          className={cn(
            'flex min-w-0 items-center gap-3 hover:bg-line/60',
            folded ? 'p-1' : 'h-full flex-1 pl-4',
          )}
        >
          <BrandMark size={32} />
          <span className="sidebar-full min-w-0">
            <span className="block truncate text-[15px] leading-tight font-bold whitespace-nowrap text-ink">
              {ja.app.name}
            </span>
            <span className="block truncate text-[11px] leading-tight text-ink-sub">
              {ja.app.company}
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setFolded((value) => !value)}
          aria-label={folded ? 'メニューを開く' : 'メニューをたたむ'}
          title={folded ? 'メニューを開く' : 'メニューをたたむ'}
          aria-expanded={!folded}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center text-ink-sub hover:bg-line/60 hover:text-ink"
        >
          {folded ? (
            <PanelLeftOpen aria-hidden="true" className="size-4.5" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="size-4.5" />
          )}
        </button>
      </div>

      <nav aria-label="メインメニュー" className="flex flex-1 flex-col overflow-y-auto px-2.5 py-3">
        {sections.map((section) => (
          <div key={section.group} className="mb-3 flex flex-col gap-0.5">
            {SECTION_LABEL[section.group] && (
              <p className="sidebar-full px-2.5 pt-1 pb-1.5 text-[11px] font-bold tracking-wider text-ink-disabled">
                {SECTION_LABEL[section.group]}
              </p>
            )}
            {section.items.map((item) => (
              <SideLink key={item.to} item={item} folded={folded} />
            ))}
            {section.group === 'main' && <NotificationBell variant="menu" />}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-line p-2.5">
        <div className="flex items-center gap-2.5 px-1.5 py-1.5">
          <span
            aria-hidden="true"
            title={folded ? `${user.name}（${ja.role[mainRole]}）` : undefined}
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full! text-xs font-bold',
              AVATAR_TONE[mainRole],
            )}
          >
            {initialsOf(user.name)}
          </span>
          <span className="sidebar-full min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-ink">{user.name}</span>
            <span className="block truncate text-xs text-ink-sub">
              {user.roles
                .filter(isRole)
                .map((role) => ja.role[role])
                .join('・')}
            </span>
          </span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logout.isPending}
            aria-label={ja.auth.logout}
            title={ja.auth.logout}
            className="sidebar-full flex size-8 shrink-0 cursor-pointer items-center justify-center text-ink-sub hover:bg-line/60 hover:text-danger disabled:opacity-45"
          >
            <LogOut aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="sidebar-full mt-1.5 px-1.5">
          <LanguageSwitch className="w-full" />
          <ThemeSwitch />
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={logout.isPending}
          aria-label={ja.auth.logout}
          title={ja.auth.logout}
          className="sidebar-compact mt-1 h-9 w-full cursor-pointer items-center justify-center text-ink-sub hover:bg-line/60 hover:text-danger"
        >
          <LogOut aria-hidden="true" className="size-4.5" />
        </button>
      </div>
    </aside>
  );
}

function SideLink({ item, folded }: { item: NavItem; folded: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={folded ? item.sideLabel : undefined}
      className={({ isActive }) =>
        cn(
          'nav-link relative flex h-9 items-center gap-3 px-2.5 text-[13.5px] transition-colors',
          isActive
            ? 'bg-surface font-bold text-ink shadow-(--shadow-card) ring-1 ring-line before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:bg-main'
            : 'font-medium text-ink-sub hover:bg-line/60 hover:text-ink',
        )
      }
    >
      <item.icon aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.8} />
      <span className="nav-label truncate">{item.sideLabel}</span>
    </NavLink>
  );
}

/** さくら (pink, girl MoraBot) or the standard look; remembered per person in this browser. */
function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  return (
    <Switch
      className="mt-1 min-h-9 px-1 text-xs text-ink-sub"
      checked={theme === 'sakura'}
      onChange={(on) => setTheme(on ? 'sakura' : 'standard')}
      label="さくらテーマ"
    />
  );
}
