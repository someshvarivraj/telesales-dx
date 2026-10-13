import { Role } from '@telesales/shared';
import { createBrowserRouter, Outlet, type RouteObject } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireRole } from '@/features/auth/guards/RequireRole';
import { RequireSession } from '@/features/auth/guards/RequireSession';
import { RoleHomeRedirect } from '@/features/auth/guards/RoleHomeRedirect';
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { HomePage } from '@/features/home/HomePage';
import { ModulePlaceholderPage } from '@/features/system/ModulePlaceholderPage';
import { NotFoundPage } from '@/features/system/NotFoundPage';
import { ja } from '@/i18n/ja';
import { paths } from './paths';

/** Wraps a role's area so every child route is restricted to that role. */
function roleArea(role: Role, children: RouteObject[]): RouteObject {
  return {
    element: (
      <RequireRole role={role}>
        <Outlet />
      </RequireRole>
    ),
    children,
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
      { index: true, element: <RoleHomeRedirect /> },
      roleArea(Role.Telema, [
        { path: paths.telema.home, element: <HomePage /> },
        { path: paths.telema.calls, element: <ModulePlaceholderPage title={ja.module.calls} /> },
        {
          path: paths.telema.schedule,
          element: <ModulePlaceholderPage title={ja.module.schedule} />,
        },
      ]),
      roleArea(Role.Sales, [
        { path: paths.sales.home, element: <HomePage /> },
        { path: paths.sales.calls, element: <ModulePlaceholderPage title={ja.module.calls} /> },
        {
          path: paths.sales.schedule,
          element: <ModulePlaceholderPage title={ja.module.schedule} />,
        },
      ]),
      roleArea(Role.Admin, [
        { path: paths.admin.home, element: <HomePage /> },
        { path: paths.admin.users, element: <ModulePlaceholderPage title={ja.module.users} /> },
        { path: paths.admin.masters, element: <ModulePlaceholderPage title={ja.module.masters} /> },
      ]),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes);
}
