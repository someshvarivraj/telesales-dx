import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { clearViewState, useViewState } from './viewState';

function wrapperFor(userId: string) {
  const client = new QueryClient();
  client.setQueryData(['auth', 'session'], { id: userId, name: 'x', roles: [], permissions: [] });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useViewState (screens come back as they were, 11/18)', () => {
  afterEach(() => sessionStorage.clear());

  it('gives a screen its search back after leaving and returning', () => {
    const first = renderHook(() => useViewState('calls.name', ''), { wrapper: wrapperFor('u1') });
    act(() => first.result.current[1]('協和'));
    first.unmount();
    const again = renderHook(() => useViewState('calls.name', ''), { wrapper: wrapperFor('u1') });
    expect(again.result.current[0]).toBe('協和');
  });

  it('starts from the link’s view when asked (fresh), and keeps that', () => {
    const first = renderHook(() => useViewState('calls.onlyMine', false), {
      wrapper: wrapperFor('u1'),
    });
    act(() => first.result.current[1](false));
    first.unmount();
    const fromLink = renderHook(() => useViewState('calls.onlyMine', true, { fresh: true }), {
      wrapper: wrapperFor('u1'),
    });
    expect(fromLink.result.current[0]).toBe(true);
    fromLink.unmount();
    const back = renderHook(() => useViewState('calls.onlyMine', false), {
      wrapper: wrapperFor('u1'),
    });
    expect(back.result.current[0]).toBe(true);
  });

  it('keeps each person’s view apart and forgets everything on log out', () => {
    const mine = renderHook(() => useViewState('calls.name', ''), { wrapper: wrapperFor('u1') });
    act(() => mine.result.current[1]('協和'));
    mine.unmount();
    const other = renderHook(() => useViewState('calls.name', ''), { wrapper: wrapperFor('u2') });
    expect(other.result.current[0]).toBe('');
    other.unmount();
    clearViewState();
    const afterLogout = renderHook(() => useViewState('calls.name', ''), {
      wrapper: wrapperFor('u1'),
    });
    expect(afterLogout.result.current[0]).toBe('');
  });
});
