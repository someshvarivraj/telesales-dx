import type { PlannedOutageDto } from '@telesales/shared';
import { useQuery } from '@tanstack/react-query';
import { TriangleAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/components/ui/cn';
import { apiClient } from '@/lib/api/ApiClient';
import { formatRange } from '@/lib/format';

/** From here on the notice cannot be closed: people should finish and save what they are doing. */
const SOON_MS = 30 * 60_000;

function dismissKey(outage: PlannedOutageDto): string {
  return `planned-outage-closed:${outage.startsAt}`;
}

function readDismissed(outage: PlannedOutageDto): boolean {
  try {
    return localStorage.getItem(dismissKey(outage)) === '1';
  } catch {
    return false;
  }
}

/** The login screen is before sign-in, so it asks the public endpoint. */
export function usePublicPlannedOutage() {
  return useQuery({
    queryKey: ['system', 'planned-outage'],
    queryFn: ({ signal }) =>
      apiClient.get<PlannedOutageDto | null>('/system/planned-outage', signal),
    refetchInterval: 5 * 60_000,
  });
}

/**
 * Announced downtime (request 11/4): shown to everyone from the moment an admin posts it until
 * it ends, stronger in the last 30 minutes. It works from the browser's clock, so it still says
 * why once the server has gone away.
 */
export function PlannedOutageBanner({
  outage,
  className,
}: {
  outage: PlannedOutageDto | null | undefined;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const [closedFor, setClosedFor] = useState<string | null>(null);
  // The maintenance page reads this to say when it should end (not while the status is unknown).
  useEffect(() => {
    if (outage === undefined) return;
    try {
      if (outage) localStorage.setItem('planned-outage', JSON.stringify(outage));
      else localStorage.removeItem('planned-outage');
    } catch {
      // The page works without it.
    }
  }, [outage]);
  if (!outage) return null;

  const starts = new Date(outage.startsAt).getTime();
  const ends = new Date(outage.endsAt).getTime();
  if (now >= ends) return null;
  const during = now >= starts;
  const minutesLeft = Math.max(1, Math.ceil((starts - now) / 60_000));
  const soon = !during && starts - now <= SOON_MS;
  const urgent = during || soon;
  if (!urgent && (closedFor === outage.startsAt || readDismissed(outage))) return null;

  const range = formatRange(outage.startsAt, outage.endsAt);
  const close = () => {
    try {
      localStorage.setItem(dismissKey(outage), '1');
    } catch {
      // Closed for this page only.
    }
    setClosedFor(outage.startsAt);
  };

  return (
    <div
      role={urgent ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 border px-4 py-3 text-sm',
        urgent
          ? 'border-danger bg-danger-soft text-danger'
          : 'border-warning bg-warning-soft text-warning-ink',
        className,
      )}
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-bold">
          {during
            ? `メンテナンスの時間です（${range}）。途中で使えなくなります。`
            : soon
              ? `あと${minutesLeft}分でメンテナンスが始まります（${range}）。入力中の内容を保存してください。`
              : `${range} はメンテナンスのためシステムを使えません。`}
        </p>
        {outage.note && (
          <p className="mt-0.5" data-no-translate="">
            {outage.note}
          </p>
        )}
      </div>
      {!urgent && (
        <button
          type="button"
          aria-label="お知らせを閉じる"
          onClick={close}
          className="grid size-7 shrink-0 cursor-pointer place-items-center hover:bg-surface/60"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}
