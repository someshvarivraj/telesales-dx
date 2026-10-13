import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ja } from '@/i18n/ja';
import { sessionQueryKey } from '../hooks/useSession';
import { LoginPage } from './LoginPage';

function renderLogin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(sessionQueryKey, null);
  const router = createMemoryRouter([{ path: '/login', element: <LoginPage /> }], {
    initialEntries: ['/login'],
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows inline Japanese errors when submitted empty', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: ja.auth.submitLogin }));
    expect(await screen.findByText(ja.validation.required(ja.auth.email))).toBeInTheDocument();
    expect(screen.getByText(ja.validation.required(ja.auth.password))).toBeInTheDocument();
  });

  it('shows the credential error returned by the API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'INVALID_CREDENTIALS' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText(ja.auth.email), 'tanaka@example.co.jp');
    await userEvent.type(
      screen.getByLabelText(ja.auth.password, { selector: 'input' }),
      'wrong-password',
    );
    await userEvent.click(screen.getByRole('button', { name: ja.auth.submitLogin }));
    expect(await screen.findByRole('alert')).toHaveTextContent(ja.error.INVALID_CREDENTIALS);
  });
});
