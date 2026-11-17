import { Permission } from '@telesales/shared';
import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import { GridBackdrop } from '@/components/brand/GridBackdrop';
import { MoraBot } from '@/components/brand/MoraBot';
import { ThemeProvider } from '@/components/brand/theme';
import { Alert } from '@/components/ui/Alert';
import { FeedbackProvider } from '@/components/ui/feedback';
import { StickyTopProvider } from '@/components/ui/StickyTop';
import { paths } from '@/app/paths';
import { cn } from '@/components/ui/cn';
import { AssistantWidget } from '@/features/assistant/AssistantWidget';
import {
  onCallsScreen,
  SalesPanel,
  SalesPanelProvider,
  SPLIT_WIDTH,
  useSalesPanel,
} from '@/features/calls/SalesPanel';
import { SessionExpiryWarning } from '@/features/auth/components/SessionExpiryWarning';
import { NoticeToaster } from '@/features/notifications/NoticeToaster';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { OutageOverlay } from '@/features/system/OutageOverlay';
import { PlannedOutageBanner } from '@/features/system/PlannedOutageBanner';
import { useSystemStatus } from '@/features/system/useSystemStatus';
import { ja } from '@/i18n/ja';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { TopBarMenus } from './TopBarMenus';
import { MobileNav } from './MobileNav';

/** Left menu on tablets and wider; top bar + bottom tab bar on phones. */
export function AppLayout() {
  const { id, roles, permissions } = useCurrentUser();
  const status = useSystemStatus();
  const admin = permissions.includes(Permission.Administer);
  const maintenance = status.data?.maintenance === true;
  // The schedule (request 10/29) and 架電状況 (request 11/12) use the full width of the screen.
  const { pathname } = useLocation();
  // Each page fades in and rises a little when it opens (11/16), without remounting it.
  const page = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = page.current;
    if (!el) return;
    el.classList.remove('page-enter');
    void el.offsetWidth;
    el.classList.add('page-enter');
  }, [pathname]);
  return (
    <ThemeProvider userId={id} roles={roles}>
      <FeedbackProvider>
        <SalesPanelProvider>
          <div className="min-h-dvh">
            <GridBackdrop />
            <AppSidebar />
            <div className="app-main flex min-h-dvh min-w-0 flex-col">
              <AppHeader />
              {/* A thin Teams-like top bar (11/17): language and theme as icons at the right. */}
              <div className="sticky top-0 z-30 hidden h-11 shrink-0 items-center justify-end border-b border-line bg-surface px-3 md:flex">
                <TopBarMenus />
              </div>
              <PlannedOutageBanner
                outage={status.data?.plannedOutage}
                className="sticky top-0 z-20"
              />
              {/* Bottom padding keeps the end of every page (paging, save buttons) clear of the
              MoraBot launcher in the corner. */}
              <SplitRoom />
              <main
                className={cn(
                  // Full width on every screen (11/17): content takes the room, little empty margin.
                  'w-full flex-1 px-4 pt-5 pb-40 sm:px-6 md:px-6 md:pt-4',
                  // The schedule fills the screen with one scroll inside the calendar (11/17).
                  pathname.startsWith(paths.schedule) ? 'md:pb-4' : 'md:pb-28',
                )}
              >
                {maintenance && admin && (
                  <Alert tone="warning" className="mb-5">
                    メンテナンス中です。いまは管理者だけが使えます（管理 ＞ {ja.admin.apps}{' '}
                    で終えられます）。
                  </Alert>
                )}
                <StickyTopProvider>
                  <div ref={page}>{maintenance && !admin ? <MaintenanceNotice /> : <Outlet />}</div>
                </StickyTopProvider>
              </main>
            </div>
            <MobileNav />
            <AssistantWidget />
            <SessionExpiryWarning />
            <NoticeToaster />
            <OutageOverlay />
          </div>
          <SalesPanel />
        </SalesPanelProvider>
      </FeedbackProvider>
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

/** The docked 営業の予定 takes the right side; the page gets narrower instead of hiding under it. */
function SplitRoom() {
  const panel = useSalesPanel();
  const { pathname } = useLocation();
  const split = panel?.mode === 'split' && onCallsScreen(pathname);
  useEffect(() => {
    const root = document.documentElement;
    if (split) root.style.setProperty('--split-room', SPLIT_WIDTH);
    else root.style.removeProperty('--split-room');
  }, [split]);
  return null;
}
