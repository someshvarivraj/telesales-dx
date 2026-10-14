import type { SlotLockDto } from '@telesales/shared';
import { CSRF_HEADER, CSRF_HEADER_VALUE } from '@telesales/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/ApiError';
import { slotLockApi } from './api';

const HEARTBEAT_MS = 30_000;

export type LockState =
  | { status: 'idle' }
  | { status: 'acquiring' }
  | { status: 'held'; lock: SlotLockDto }
  | { status: 'blocked'; by: string }
  | { status: 'lost' }
  | { status: 'error' };

/**
 * Holds the edit lock on one rep's time slot while the booking screen is open (spec §7):
 * heartbeats keep it alive during a long call; it is released on save/cancel, and when the
 * page closes the server lets it expire after a short time.
 */
export function useSlotLock() {
  const [state, setState] = useState<LockState>({ status: 'idle' });
  const lockId = useRef<string | null>(null);

  const release = useCallback(async () => {
    const id = lockId.current;
    lockId.current = null;
    setState({ status: 'idle' });
    if (id) {
      await slotLockApi.release(id).catch(() => undefined);
    }
  }, []);

  const acquire = useCallback(async (salesRepId: string, startsAt: string, endsAt: string) => {
    setState({ status: 'acquiring' });
    try {
      const lock = await slotLockApi.acquire(salesRepId, startsAt, endsAt);
      lockId.current = lock.id;
      setState({ status: 'held', lock });
      return true;
    } catch (error) {
      lockId.current = null;
      if (ApiError.isApiError(error) && error.code === 'SLOT_LOCKED') {
        const by = (error.details as { by?: string } | undefined)?.by ?? '';
        setState({ status: 'blocked', by });
      } else {
        setState({ status: 'error' });
      }
      return false;
    }
  }, []);

  /** Forget the lock without calling the server (it was released by saving). */
  const forget = useCallback(() => {
    lockId.current = null;
    setState({ status: 'idle' });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const id = lockId.current;
      if (!id) return;
      slotLockApi
        .heartbeat(id)
        .then((lock) => setState({ status: 'held', lock }))
        .catch(() => {
          lockId.current = null;
          setState({ status: 'lost' });
        });
    }, HEARTBEAT_MS);
    const onPageHide = () => {
      const id = lockId.current;
      if (id) {
        void fetch(`/api/slot-locks/${id}/release`, {
          method: 'POST',
          keepalive: true,
          credentials: 'same-origin',
          headers: { [CSRF_HEADER]: CSRF_HEADER_VALUE },
        });
      }
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', onPageHide);
      const id = lockId.current;
      if (id) void slotLockApi.release(id).catch(() => undefined);
    };
  }, []);

  return { state, acquire, release, forget };
}
