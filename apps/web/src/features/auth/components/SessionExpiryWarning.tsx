import { SESSION_WARNING_MS } from '@telesales/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { apiClient } from '@/lib/api/ApiClient';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { sessionExpiry } from '@/lib/api/sessionExpiry';
import { sessionQueryKey, useLogout } from '../hooks/useSession';

/**
 * 10 minutes before the session ends, says so and lets the person carry on (request 11/2), so
 * nobody loses what they are typing. When it does end, the login screen explains why.
 */
export function SessionExpiryWarning() {
  const expiresAt = useSyncExternalStore(sessionExpiry.subscribe, sessionExpiry.get);
  const [now, setNow] = useState(() => Date.now());
  const [extending, setExtending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const client = useQueryClient();
  const logout = useLogout();

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const left = expiresAt === null ? Infinity : expiresAt - now;
  useEffect(() => {
    if (left > 0) return;
    sessionExpiry.markEnded();
    client.setQueryData(sessionQueryKey, null);
  }, [left, client]);

  if (left > SESSION_WARNING_MS || left <= 0) return null;
  const minutes = Math.max(1, Math.ceil(left / 60_000));

  const extend = async () => {
    setExtending(true);
    setError(null);
    try {
      // The new end time comes back in the response header.
      await apiClient.post('/auth/extend');
    } catch (failure) {
      setError(failure);
    } finally {
      setExtending(false);
    }
  };

  return (
    <Dialog
      open
      title="まもなく自動でログアウトします"
      onClose={() => void extend()}
      footer={
        <>
          <Button variant="secondary" onClick={() => logout.mutate()}>
            ログアウトする
          </Button>
          <Button loading={extending} onClick={() => void extend()}>
            ログインを続ける
          </Button>
        </>
      }
    >
      <p className="text-base font-bold">{`あと${minutes}分でログアウトします。`}</p>
      <p className="mt-2 text-sm text-ink-sub">
        入力中の内容は、ログアウトすると保存されません。作業を続けるときは「ログインを続ける」を押してください（ここから1週間ログインしたままになります）。
      </p>
      {Boolean(error) && (
        <Alert tone="error" className="mt-3">
          {errorMessageOf(error)}
        </Alert>
      )}
    </Dialog>
  );
}
