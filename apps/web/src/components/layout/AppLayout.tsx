import { Outlet } from 'react-router';
import { AppHeader } from './AppHeader';
import { MobileNav } from './MobileNav';

export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-24 sm:px-6 md:pb-10">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}
