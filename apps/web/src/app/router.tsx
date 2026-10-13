import { Permission } from '@telesales/shared';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequirePermission } from '@/features/auth/guards/RequirePermission';
import { RequireSession } from '@/features/auth/guards/RequireSession';
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { HomePage } from '@/features/home/HomePage';
import { adminMenu, mainMenu, type MenuItem } from '@/features/home/menus';
import { ModulePlaceholderPage } from '@/features/system/ModulePlaceholderPage';
import { NotFoundPage } from '@/features/system/NotFoundPage';
import { paths } from './paths';

/**
 * Every module route is guarded by the same permissions that decide whether its
 * menu card is shown. Replace the placeholder element as each screen is built.
 */
function moduleRoute(item: MenuItem): RouteObject {
  return {
    path: `${item.path}/*`,
    element: (
      <RequirePermission anyOf={item.anyOf}>
        <ModulePlaceholderPage title={item.title} />
      </RequirePermission>
    ),
  };
}

export const routes: RouteObject[] = [
  { path: paths.login, element: <LoginPage /> },
  {
    path: paths.changePassword,
    element: (
      <RequireSession allowPendingPasswordChange>
        <ChangePasswordPage />
      </RequireSession>
    ),
  },
  {
    path: paths.root,
    element: (
      <RequireSession>
        <AppLayout />
      </RequireSession>
    ),
    children: [
      { index: true, element: <Navigate to={paths.home} replace /> },
      { path: paths.home, element: <HomePage /> },
      ...mainMenu.map(moduleRoute),
      {
        path: paths.admin.root,
        element: (
          <RequirePermission anyOf={[Permission.Administer, Permission.EditAreaTable]}>
            <Navigate to={paths.home} replace />
          </RequirePermission>
        ),
      },
      ...adminMenu.map(moduleRoute),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes);
}
