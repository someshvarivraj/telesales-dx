import { type SetStateAction, useCallback, useEffect, useState } from 'react';
import { useSession } from '@/features/auth/hooks/useSession';

/**
 * What a person has typed, kept in this browser until it is saved (request 11/2): a refresh, a
 * closed window or a logout must not lose a half-filled form. Each draft is per user and per form,
 * and is dropped after a week.
 */
const PREFIX = 'telesales.draft.';
const KEEP_MS = 7 * 24 * 60 * 60_000;

interface Stored<T> {
  value: T;
  savedAt: number;
}

function storageKey(userId: string, key: string): string {
  return `${PREFIX}${userId}.${key}`;
}

function read<T>(key: string): Stored<T> | null {
  try {
    const text = localStorage.getItem(key);
    if (!text) return null;
    const stored = JSON.parse(text) as Stored<T>;
    if (Date.now() - stored.savedAt > KEEP_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify({ value, savedAt: Date.now() }));
  } catch {
    // Storage full or blocked: the form still works, it is only not kept.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to do.
  }
}

/** Drops every draft older than a week (called once when the app starts). */
export function pruneDrafts(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) read(key);
    }
  } catch {
    // Storage blocked.
  }
}

export interface Draft<T> {
  value: T;
  set: (value: SetStateAction<T>) => void;
  /** The value was brought back from an earlier visit. */
  restoredAt: number | null;
  /** Something differs from the starting values. */
  dirty: boolean;
  /** Back to the starting values; the kept copy is dropped. Also call after saving. */
  reset: () => void;
  /** Saved and still on screen: what is shown now becomes the starting point. */
  commit: () => void;
}

/**
 * useState that survives a refresh. `key` names the form (and the record it edits); `null`
 * turns keeping off. The kept copy is removed as soon as the value is back to `initial`.
 */
export function useDraft<T>(key: string | null, initial: T | (() => T)): Draft<T> {
  const userId = useSession().data?.id ?? null;
  const fullKey = key && userId ? storageKey(userId, key) : null;
  const [start, setStart] = useState(initial);
  const [restored] = useState(() => (fullKey ? read<T>(fullKey) : null));
  const [value, setValue] = useState<T>(() => restored?.value ?? start);
  const dirty = JSON.stringify(value) !== JSON.stringify(start);

  // Written shortly after typing stops; removed when nothing is left to keep.
  useEffect(() => {
    if (!fullKey) return;
    if (!dirty) {
      remove(fullKey);
      return;
    }
    const timer = window.setTimeout(() => write(fullKey, value), 300);
    return () => window.clearTimeout(timer);
  }, [fullKey, value, dirty]);

  // Written at once when the page is closed or refreshed mid-typing.
  useEffect(() => {
    if (!fullKey) return;
    const flush = () => {
      if (dirty) write(fullKey, value);
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [fullKey, value, dirty]);

  const reset = useCallback(() => {
    if (fullKey) remove(fullKey);
    setValue(start);
  }, [fullKey, start]);

  const commit = useCallback(() => {
    if (fullKey) remove(fullKey);
    setStart(value);
  }, [fullKey, value]);

  return {
    value,
    set: setValue,
    restoredAt: restored && dirty ? restored.savedAt : null,
    dirty,
    reset,
    commit,
  };
}
