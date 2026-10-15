import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { cn } from '@/components/ui/cn';
import { formatDateTime } from '@/lib/format';
import { ja } from '@/i18n/ja';
import { useMarkRead, useNotifications } from './api';

interface NotificationBellProps {
  /**
   * icon — a bell button (phone top bar); the panel drops down to the left.
   * menu — a menu row in the left sidebar; the panel opens beside the sidebar.
   */
  variant?: 'icon' | 'menu';
}

/** On-screen notices (spec §8). */
export function NotificationBell({ variant = 'icon' }: NotificationBellProps) {
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
        className={cn(
          'relative flex cursor-pointer items-center text-ink-sub hover:bg-hover hover:text-ink',
          variant === 'icon'
            ? 'size-10 justify-center'
            : 'nav-link h-10 w-full gap-3 px-3 text-sm font-medium',
          open && 'bg-main-soft text-main',
        )}
      >
        <Bell aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} />
        {variant === 'menu' && <span className="nav-label">{ja.nav.notifications}</span>}
        {unread > 0 && (
          <span
            className={cn(
              'min-w-[18px] bg-danger px-1 text-center text-[11px] leading-[18px] font-bold text-white',
              variant === 'icon' ? 'absolute top-1 right-1' : 'ml-auto',
            )}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          className={cn(
            'z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden border border-line bg-surface shadow-(--shadow-raised)',
            variant === 'icon'
              ? 'absolute right-0 mt-2'
              : 'fixed top-3 left-[calc(var(--sidebar-w)+0.5rem)]',
          )}
        >
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
                    'flex w-full cursor-pointer gap-3 px-4 py-3 text-left hover:bg-hover',
                    !item.readAt && 'bg-main-soft/50',
                  )}
                >
                  <span
                    className={cn(
                      'mt-1.5 size-2 shrink-0',
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
