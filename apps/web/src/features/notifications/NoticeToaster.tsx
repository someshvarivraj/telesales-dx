import type { NotificationDto } from '@telesales/shared';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { cn } from '@/components/ui/cn';
import { useMarkRead, useNotifications } from './api';
import { noticeKindOf, relativeTime, TONE_CLASS } from './noticeKinds';

const SHOW_MS = 7000;
const MAX_SHOWN = 3;

/**
 * Teams-style pop-ups (request 11/17): when a new notice arrives, a banner slides in at the
 * bottom right with its kind, title and line; clicking opens it (and marks it read). It leaves
 * by itself after a few seconds, waits while the pointer is on it, and × closes it. Notices
 * already there when the page opened are not shown again.
 */
export function NoticeToaster() {
  const query = useNotifications();
  const markRead = useMarkRead();
  const navigate = useNavigate();
  const seen = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<NotificationDto[]>([]);

  useEffect(() => {
    const items = query.data?.items;
    if (!items) return;
    if (!seen.current) {
      seen.current = new Set(items.map((item) => item.id));
      return;
    }
    const known = seen.current;
    const fresh = items.filter((item) => !known.has(item.id) && !item.readAt);
    items.forEach((item) => known.add(item.id));
    if (fresh.length > 0) setToasts((list) => [...fresh, ...list].slice(0, MAX_SHOWN));
  }, [query.data]);

  const close = (id: string) => setToasts((list) => list.filter((item) => item.id !== id));

  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-28 z-40 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2 max-md:bottom-36"
    >
      {toasts.map((item) => (
        <Toast
          key={item.id}
          item={item}
          onClose={() => close(item.id)}
          onOpen={() => {
            if (!item.readAt) markRead.mutate([item.id]);
            close(item.id);
            if (item.linkPath) navigate(item.linkPath);
          }}
        />
      ))}
    </div>
  );
}

function Toast({
  item,
  onClose,
  onOpen,
}: {
  item: NotificationDto;
  onClose: () => void;
  onOpen: () => void;
}) {
  const kind = noticeKindOf(item.noticeCode);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (hover) return;
    const timer = window.setTimeout(onClose, SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [hover, onClose]);
  const Icon = kind.icon;
  return (
    <div
      role="status"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="notice-toast pointer-events-auto flex items-start gap-3 border border-line border-l-4 border-l-main bg-surface p-3 shadow-(--shadow-popover)"
    >
      <span
        className={cn('flex size-9 shrink-0 items-center justify-center', TONE_CLASS[kind.tone])}
      >
        <Icon aria-hidden="true" className="size-4.5" />
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 cursor-pointer text-left">
        <span className="flex items-baseline justify-between gap-2 text-[11px] text-ink-sub">
          <span className="font-bold">{kind.label}</span>
          <span>{relativeTime(item.createdAt)}</span>
        </span>
        <span className="mt-0.5 line-clamp-2 block text-sm font-bold text-ink">{item.title}</span>
        {item.body && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-ink-sub">{item.body}</span>
        )}
      </button>
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center text-ink-sub hover:bg-column hover:text-ink"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
