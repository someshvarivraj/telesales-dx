import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDraft } from './drafts';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient();
  client.setQueryData(['auth', 'session'], { id: 'u1' });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe('useDraft (request 11/2: a refresh keeps what was typed)', () => {
  it('brings back what was typed after the page is opened again', () => {
    vi.useFakeTimers();
    const first = renderHook(() => useDraft('memo:1', ''), { wrapper });
    act(() => first.result.current.set('定休日 水曜'));
    act(() => vi.advanceTimersByTime(400));
    first.unmount();

    const again = renderHook(() => useDraft('memo:1', ''), { wrapper });
    expect(again.result.current.value).toBe('定休日 水曜');
    expect(again.result.current.restoredAt).not.toBeNull();
  });

  it('forgets it after reset or saving', () => {
    vi.useFakeTimers();
    const first = renderHook(() => useDraft('memo:2', ''), { wrapper });
    act(() => first.result.current.set('下書き'));
    act(() => vi.advanceTimersByTime(400));
    act(() => first.result.current.reset());
    expect(first.result.current.value).toBe('');
    first.unmount();

    const again = renderHook(() => useDraft('memo:2', ''), { wrapper });
    expect(again.result.current.value).toBe('');
    expect(again.result.current.dirty).toBe(false);
  });

  it('keeps one draft per user', () => {
    vi.useFakeTimers();
    const first = renderHook(() => useDraft('memo:3', ''), { wrapper });
    act(() => first.result.current.set('私のメモ'));
    act(() => vi.advanceTimersByTime(400));
    expect(Object.keys(localStorage).some((key) => key.includes('.u1.memo:3'))).toBe(true);
  });

  it('takes the saved text as the new start after commit', () => {
    const draft = renderHook(() => useDraft('memo:4', '古い'), { wrapper });
    act(() => draft.result.current.set('新しい'));
    act(() => draft.result.current.commit());
    expect(draft.result.current.dirty).toBe(false);
    expect(draft.result.current.value).toBe('新しい');
  });
});
