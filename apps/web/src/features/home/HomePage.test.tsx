import { resolvePermissions, Role, type SessionUser } from '@telesales/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ja } from '@/i18n/ja';
import { sessionQueryKey } from '../auth/hooks/useSession';
import { HomePage } from './HomePage';

function renderHomeAs(roles: Role[]) {
  const user: SessionUser = {
    id: '00000000-0000-0000-0000-000000000001',
    employeeNo: null,
    email: 'user@example.co.jp',
    name: 'テスト',
    roles,
    permissions: resolvePermissions(roles),
    mustChangePassword: false,
  };
  const queryClient = new QueryClient();
  queryClient.setQueryData(sessionQueryKey, user);
  const router = createMemoryRouter([{ path: '/home', element: <HomePage /> }], {
    initialEntries: ['/home'],
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('HomePage', () => {
  it('shows the three main modules to a viewer, without the admin section', () => {
    renderHomeAs([Role.Viewer]);
    expect(screen.getByRole('link', { name: ja.module.calls })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: ja.module.schedule })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: ja.module.appointments })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: ja.admin.title })).not.toBeInTheDocument();
  });

  it('adds the admin menus for an admin', () => {
    renderHomeAs([Role.Sales, Role.Admin]);
    expect(screen.getByRole('heading', { name: ja.admin.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: ja.admin.users })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: ja.admin.notices })).toBeInTheDocument();
  });
});
