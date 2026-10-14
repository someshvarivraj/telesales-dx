import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { cn } from '@/components/ui/cn';
import { formatDateTime } from '@/lib/format';
import { ja } from '@/i18n/ja';
import { useMarkRead, useNotifications } from './api';

/** On-screen notices (spec §8). */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const query = useNotifications();
  const markRead = useMarkRead();
  const navigate = useNavigate();
  const panel = useRef<HTMLDivElement>(null);
  const unread = query.data?.unreadCount ?? 0;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (panel.current && !panel.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={
          unread > 0 ? `${ja.nav.notifications}（未読${unread}件）` : ja.nav.notifications
        }
        className="relative flex size-10 cursor-pointer items-center justify-center rounded-md text-ink-sub hover:bg-column hover:text-ink"
      >
        <Bell aria-hidden="true" className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] rounded-full bg-danger px-1 text-center text-[11px] leading-[18px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-(--radius-card) border border-line bg-surface shadow-(--shadow-raised)">
          <div className="flex items-center border-b border-line px-4 py-2.5">
            <span className="text-sm font-bold">{ja.nav.notifications}</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markRead.mutate('all')}
                className="ml-auto cursor-pointer text-xs font-bold text-link hover:underline"
              >
                すべて既読にする
              </button>
            )}
          </div>
          <ul className="max-h-[60dvh] overflow-y-auto">
            {(query.data?.items ?? []).length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-ink-sub">お知らせはありません。</li>
            )}
            {query.data?.items.map((item) => (
              <li key={item.id} className="border-b border-line last:border-0">
                <button
                  type="button"
                  onClick={() => {
                    if (!item.readAt) markRead.mutate([item.id]);
                    setOpen(false);
                    if (item.linkPath) navigate(item.linkPath);
                  }}
                  className={cn(
                    'flex w-full cursor-pointer gap-3 px-4 py-3 text-left hover:bg-canvas',
                    !item.readAt && 'bg-main-soft/50',
                  )}
                >
                  <span
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      item.readAt ? 'bg-transparent' : 'bg-main',
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">{item.title}</span>
                    <span className="mt-0.5 block text-xs text-ink-sub">
                      {item.noticeCode}・{formatDateTime(item.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
