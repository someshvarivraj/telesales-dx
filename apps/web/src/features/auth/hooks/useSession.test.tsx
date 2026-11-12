import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionQueryKey, useLogin, useSession } from './useSession';

const user = {
  id: 'u1',
  employeeNo: null,
  email: 'nagata@example.co.jp',
  name: '永田',
  roles: ['TELEMA'],
  permissions: [],
  mustChangePassword: false,
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('login while the first session check is still on its way (report 11/12)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps the signed-in user when the earlier "nobody" answer arrives late', async () => {
    let answerMe: (() => void) | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/login')) return json(200, { user });
      if (url.endsWith('/auth/me')) {
        // Sent before login, without the cookie: "nobody", but only after login finished.
        await new Promise<void>((resolve) => {
          answerMe = resolve;
          init?.signal?.addEventListener('abort', () => resolve());
        });
        if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
        return json(401, { error: { code: 'UNAUTHENTICATED' } });
      }
      return json(200, {});
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => ({ session: useSession(), login: useLogin() }), {
      wrapper,
    });
    await waitFor(() => expect(answerMe).toBeDefined());

    await act(() =>
      result.current.login.mutateAsync({ email: user.email, password: 'correct-password' }),
    );
    act(() => answerMe?.());

    await waitFor(() => expect(queryClient.getQueryData(sessionQueryKey)).toEqual(user));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(queryClient.getQueryData(sessionQueryKey)).toEqual(user);
  });
});
