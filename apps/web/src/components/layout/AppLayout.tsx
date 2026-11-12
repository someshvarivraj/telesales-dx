import { Permission } from '@telesales/shared';
import { Outlet, useLocation } from 'react-router';
import { GridBackdrop } from '@/components/brand/GridBackdrop';
import { MoraBot } from '@/components/brand/MoraBot';
import { ThemeProvider } from '@/components/brand/theme';
import { Alert } from '@/components/ui/Alert';
import { cn } from '@/components/ui/cn';
import { AssistantWidget } from '@/features/assistant/AssistantWidget';
import { SessionExpiryWarning } from '@/features/auth/components/SessionExpiryWarning';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { OutageOverlay } from '@/features/system/OutageOverlay';
import { PlannedOutageBanner } from '@/features/system/PlannedOutageBanner';
import { useSystemStatus } from '@/features/system/useSystemStatus';
import { ja } from '@/i18n/ja';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { MobileNav } from './MobileNav';
import { isWidePage } from './navItems';

/** Left menu on tablets and wider; top bar + bottom tab bar on phones. */
export function AppLayout() {
  const { id, roles, permissions } = useCurrentUser();
  const status = useSystemStatus();
  const admin = permissions.includes(Permission.Administer);
  const maintenance = status.data?.maintenance === true;
  // The schedule (request 10/29) and 架電状況 (request 11/12) use the full width of the screen.
  const wide = isWidePage(useLocation().pathname);
  return (
    <ThemeProvider userId={id} roles={roles}>
      <div className="min-h-dvh">
        <GridBackdrop />
        <AppSidebar />
        <div className="app-main flex min-h-dvh min-w-0 flex-col">
          <AppHeader />
          <PlannedOutageBanner outage={status.data?.plannedOutage} className="sticky top-0 z-20" />
          {/* Bottom padding keeps the end of every page (paging, save buttons) clear of the
              MoraBot launcher in the corner. */}
          <main
            className={cn(
              'mx-auto w-full flex-1 px-4 pt-5 pb-40 sm:px-6 md:pt-7 md:pb-28',
              wide ? 'md:px-5' : 'max-w-7xl md:px-8',
            )}
          >
            {maintenance && admin && (
              <Alert tone="warning" className="mb-5">
                メンテナンス中です。いまは管理者だけが使えます（管理 ＞ {ja.admin.apps}{' '}
                で終えられます）。
              </Alert>
            )}
            {maintenance && !admin ? <MaintenanceNotice /> : <Outlet />}
          </main>
        </div>
        <MobileNav />
        <AssistantWidget />
        <SessionExpiryWarning />
        <OutageOverlay />
      </div>
    </ThemeProvider>
  );
}

function MaintenanceNotice() {
  return (
    <section className="flex flex-col items-center px-4 py-16 text-center">
      <MoraBot mood="schedule" size={140} className="mb-6" title="" animate />
      <h1 className="text-xl font-bold">ただいまメンテナンス中です</h1>
      <p className="mt-2 text-ink-sub">
        終わると自動でもとの画面に戻ります。しばらくお待ちください。
      </p>
    </section>
  );
}
