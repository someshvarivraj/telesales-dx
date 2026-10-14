import { Permission } from '@telesales/shared';
import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { AdminLayout } from '@/features/admin/AdminLayout';
import { AreaTablePage } from '@/features/admin/AreaTablePage';
import { AuditPage } from '@/features/admin/AuditPage';
import { CalendarAdminPage } from '@/features/admin/CalendarAdminPage';
import { LocksPage } from '@/features/admin/LocksPage';
import { NoticesPage } from '@/features/admin/NoticesPage';
import { OptionsPage } from '@/features/admin/OptionsPage';
import { SettingsPage } from '@/features/admin/SettingsPage';
import { UsersPage } from '@/features/admin/UsersPage';
import { AppointmentListPage } from '@/features/appointments/AppointmentListPage';
import { AppointmentPage } from '@/features/appointments/AppointmentPage';
import { AppointmentsLayout } from '@/features/appointments/AppointmentsLayout';
import { ChangeRequestsPage } from '@/features/appointments/ChangeRequestsPage';
import { DayBeforePage } from '@/features/appointments/DayBeforePage';
import { MailPage } from '@/features/appointments/MailPage';
import { RequirePermission } from '@/features/auth/guards/RequirePermission';
import { RequireSession } from '@/features/auth/guards/RequireSession';
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { CallsLayout } from '@/features/calls/CallsLayout';
import { CallTargetsPage } from '@/features/calls/CallTargetsPage';
import { CompanyPage } from '@/features/calls/CompanyPage';
import { DuplicatesPage } from '@/features/calls/DuplicatesPage';
import { ImportHistoryPage } from '@/features/calls/ImportHistoryPage';
import { ListImportPage } from '@/features/calls/ListImportPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { HomePage } from '@/features/home/HomePage';
import { adminMenu, visibleItems } from '@/features/home/menus';
import { BookingPage } from '@/features/schedule/BookingPage';
import { SchedulePage } from '@/features/schedule/SchedulePage';
import { NotFoundPage } from '@/features/system/NotFoundPage';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { paths } from './paths';

/** The same permissions decide whether a menu is shown and whether its route opens. */
function guard(anyOf: readonly Permission[], element: ReactNode): ReactNode {
  return <RequirePermission anyOf={anyOf}>{element}</RequirePermission>;
}

const view = [Permission.ViewData] as const;
const adminOnly = [Permission.Administer] as const;

/** /admin opens the first admin screen this user can use. */
function AdminIndex() {
  const { permissions } = useCurrentUser();
  const [first] = visibleItems(adminMenu, permissions);
  return <Navigate to={first?.path ?? paths.home} replace />;
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
      {
        path: paths.calls,
        element: guard(view, <CallsLayout />),
        children: [
          { index: true, element: <CallTargetsPage /> },
          { path: 'import', element: guard([Permission.ImportLists], <ListImportPage />) },
          { path: 'imports', element: <ImportHistoryPage /> },
          {
            path: 'duplicates',
            element: guard([Permission.ResolveDuplicates], <DuplicatesPage />),
          },
        ],
      },
      { path: '/calls/companies/:id', element: guard(view, <CompanyPage />) },
      { path: paths.schedule, element: guard(view, <SchedulePage />) },
      {
        path: paths.book,
        element: guard(
          [
            Permission.ManageTelemaAppointments,
            Permission.ManageSalesAppointments,
            Permission.Administer,
          ],
          <BookingPage />,
        ),
      },
      {
        path: paths.appointments,
        element: guard(view, <AppointmentsLayout />),
        children: [
          { index: true, element: <AppointmentListPage /> },
          { path: 'day-before', element: <DayBeforePage /> },
          { path: 'change-requests', element: <ChangeRequestsPage /> },
        ],
      },
      { path: '/appointments/:id', element: guard(view, <AppointmentPage />) },
      { path: '/appointments/:id/mail/:kind', element: guard(view, <MailPage />) },
      { path: paths.dashboard, element: guard(view, <DashboardPage />) },
      {
        path: paths.admin.root,
        element: guard([Permission.Administer, Permission.EditAreaTable], <AdminLayout />),
        children: [
          { index: true, element: <AdminIndex /> },
          { path: 'users', element: guard(adminOnly, <UsersPage />) },
          { path: 'area-table', element: <AreaTablePage /> },
          { path: 'calendar', element: guard(adminOnly, <CalendarAdminPage />) },
          { path: 'options', element: guard(adminOnly, <OptionsPage />) },
          { path: 'notices', element: guard(adminOnly, <NoticesPage />) },
          { path: 'locks', element: guard(adminOnly, <LocksPage />) },
          { path: 'settings', element: guard(adminOnly, <SettingsPage />) },
          { path: 'audit', element: guard(adminOnly, <AuditPage />) },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes);
}
