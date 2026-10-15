import { Permission } from '@telesales/shared';
import { Outlet } from 'react-router';
import { GridBackdrop } from '@/components/brand/GridBackdrop';
import { MoraBot } from '@/components/brand/MoraBot';
import { Alert } from '@/components/ui/Alert';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { useSystemStatus } from '@/features/system/useSystemStatus';
import { ja } from '@/i18n/ja';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { MobileNav } from './MobileNav';

/** Left menu on tablets and wider; top bar + bottom tab bar on phones. */
export function AppLayout() {
  const { permissions } = useCurrentUser();
  const status = useSystemStatus();
  const admin = permissions.includes(Permission.Administer);
  const maintenance = status.data?.maintenance === true;
  return (
    <div className="min-h-dvh">
      <GridBackdrop />
      <AppSidebar />
      <div className="app-main flex min-h-dvh min-w-0 flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-5 pb-24 sm:px-6 md:px-8 md:pt-7 md:pb-12">
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
    </div>
  );
}

function MaintenanceNotice() {
  return (
    <section className="flex flex-col items-center px-4 py-16 text-center">
      <MoraBot mood="writing" size={140} className="mb-6" title="" animate />
      <h1 className="text-xl font-bold">ただいまメンテナンス中です</h1>
      <p className="mt-2 text-ink-sub">
        終わると自動でもとの画面に戻ります。しばらくお待ちください。
      </p>
    </section>
  );
}
