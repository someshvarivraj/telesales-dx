import {
  type AssistantConversationDto,
  resolvePermissions,
  Role,
  type SessionUser,
} from '@telesales/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { sessionQueryKey } from '../auth/hooks/useSession';
import type * as AssistantApi from './api';
import { AssistantWidget } from './AssistantWidget';

const USER_ID = '00000000-0000-0000-0000-000000000001';
const CONVERSATION: AssistantConversationDto = {
  id: '00000000-0000-0000-0000-0000000000c1',
  title: '前日確認のやり方',
  messages: [
    {
      id: 'm1',
      role: 'assistant',
      content: '[前日確認](/appointments/day-before) の画面を開きました。',
      steps: [{ text: '画面を開く（/appointments/day-before）', ok: true }],
      question: null,
      openedPath: '/appointments/day-before',
      actions: [],
      createdAt: '2026-10-28T06:00:00.000Z',
    },
  ],
};

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof AssistantApi>()),
  useAssistantStatus: () => ({ data: { enabled: true } }),
  fetchConversation: async () => CONVERSATION,
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});

function renderAt(path: string) {
  const user: SessionUser = {
    id: USER_ID,
    employeeNo: null,
    email: 'user@example.co.jp',
    name: 'テスト',
    roles: [Role.Telema],
    permissions: resolvePermissions([Role.Telema]),
    mustChangePassword: false,
  };
  window.localStorage.setItem(
    `telesales.assistant.${USER_ID}`,
    JSON.stringify({ conversationId: CONVERSATION.id }),
  );
  const queryClient = new QueryClient();
  queryClient.setQueryData(sessionQueryKey, user);
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <Outlet />
            <AssistantWidget />
          </>
        ),
        children: [
          { path: '/home', element: <h1>ホームの画面</h1> },
          { path: '/appointments/day-before', element: <h1>前日確認の画面</h1> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('MoraBot links to screens', () => {
  it('shows the screen and steps aside when 「○○」を開きました is pressed', async () => {
    const router = renderAt('/home');
    await userEvent.click(screen.getByRole('button', { name: /MoraBotにおまかせ/ }));
    const opened = await screen.findByRole('link', { name: /「前日確認」を開きました/ });
    await userEvent.click(opened);
    expect(router.state.location.pathname).toBe('/appointments/day-before');
    expect(screen.getByRole('heading', { name: '前日確認の画面' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'MoraBot' })).not.toBeInTheDocument();
    // The conversation is kept: opening MoraBot again brings it back.
    await userEvent.click(screen.getByRole('button', { name: /MoraBotにおまかせ/ }));
    expect(await screen.findByRole('link', { name: /「前日確認」を開きました/ })).toBeVisible();
  });

  it('also works when that screen is already open behind the panel', async () => {
    renderAt('/appointments/day-before');
    await userEvent.click(screen.getByRole('button', { name: /MoraBotにおまかせ/ }));
    await userEvent.click(await screen.findByRole('link', { name: /「前日確認」を開きました/ }));
    expect(screen.queryByRole('region', { name: 'MoraBot' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '前日確認の画面' })).toBeVisible();
  });

  it('a link inside the reply does the same', async () => {
    const router = renderAt('/home');
    await userEvent.click(screen.getByRole('button', { name: /MoraBotにおまかせ/ }));
    await userEvent.click(await screen.findByRole('link', { name: '前日確認' }));
    expect(router.state.location.pathname).toBe('/appointments/day-before');
    expect(screen.queryByRole('region', { name: 'MoraBot' })).not.toBeInTheDocument();
  });
});
