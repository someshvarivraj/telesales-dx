import { type SetStateAction, useEffect, useState } from 'react';
import { useSession } from '@/features/auth/hooks/useSession';

/**
 * What a screen was showing — its search words, filters, list, page, tab — kept while the person
 * works (11/18: after opening a company and pressing 戻る, the search was gone). Kept per browser
 * tab and per person in sessionStorage, so it survives going back and a reload, never reaches
 * another tab or person, and is cleared on log out.
 */
const PREFIX = 'telesales.view.';

function storageKey(userId: string, key: string): string {
  return `${PREFIX}${userId}.${key}`;
}

function read<T>(key: string): { value: T } | null {
  try {
    const text = sessionStorage.getItem(key);
    return text === null ? null : { value: JSON.parse(text) as T };
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the screen still works, it is only not kept.
  }
}

/** Forgets every screen's kept state (on log out). */
export function clearViewState(): void {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(PREFIX)) sessionStorage.removeItem(key);
    }
  } catch {
    // Storage blocked.
  }
}

/**
 * useState that a screen gets back when the person returns to it. `key` names the screen and
 * the value ("calls.search"). `fresh`: start from `initial` this time and keep that — for a link
 * that asks for a particular view (e.g. 「今日の割り振り」 from Home), which must win over what was
 * kept before.
 */
export function useViewState<T>(
  key: string,
  initial: T | (() => T),
  options: { fresh?: boolean } = {},
): [T, (value: SetStateAction<T>) => void] {
  const session = useSession();
  const userId = session.data?.id ?? 'anonymous';
  const fullKey = storageKey(userId, key);
  const [value, setValue] = useState<T>(() => {
    const kept = options.fresh ? null : read<T>(fullKey);
    if (kept) return kept.value;
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });
  // Written after every change (and once at the start, so a `fresh` view replaces the old one).
  useEffect(() => {
    write(fullKey, value);
  }, [fullKey, value]);
  return [value, setValue];
}
