import type { NotificationDto } from '@telesales/shared';
import { ArrowRight, Bell, CheckCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { paths } from '@/app/paths';
import { MoraBot } from '@/components/brand/MoraBot';
import { cn } from '@/components/ui/cn';
import { formatDateTime } from '@/lib/format';
import { ja } from '@/i18n/ja';
import { useMarkRead, useNotifications } from './api';
import {
  DAY_GROUP_LABEL,
  type DayGroup,
  dayGroupOf,
  noticeKindOf,
  relativeTime,
  TONE_CLASS,
} from './noticeKinds';

interface NotificationBellProps {
  /**
   * icon — a bell button (phone top bar); the panel drops down below the bar.
   * menu — a menu row in the left sidebar; the panel opens beside the sidebar.
   */
  variant?: 'icon' | 'menu';
}

type Filter = 'all' | 'unread';

/** On-screen notices (spec §8), laid out like a chat app's activity feed. */
export function NotificationBell({ variant = 'icon' }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const query = useNotifications();
  const unread = query.data?.unreadCount ?? 0;
  const panel = useRef<HTMLDivElement>(null);

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
          'relative flex cursor-pointer items-center text-ink-sub hover:text-ink',
          variant === 'icon'
            ? 'size-10 justify-center hover:bg-hover'
            : 'nav-link h-9 w-full gap-3 px-2.5 text-[13.5px] font-medium hover:bg-line/60',
          open && (variant === 'icon' ? 'bg-hover text-ink' : 'bg-line/60 text-ink'),
        )}
      >
        <span className="relative">
          <Bell
            aria-hidden="true"
            className={variant === 'icon' ? 'size-5 shrink-0' : 'size-[18px] shrink-0'}
            strokeWidth={1.8}
          />
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-2 h-4 min-w-4 rounded-full! bg-danger px-1 text-center text-[10px] leading-4 font-bold text-white ring-2 ring-surface">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </span>
        {variant === 'menu' && <span className="nav-label">{ja.nav.notifications}</span>}
      </button>
      {open && (
        <ActivityPanel
          items={query.data?.items ?? []}
          unread={unread}
          loading={query.isPending}
          onClose={() => setOpen(false)}
          className={
            variant === 'icon'
              ? 'fixed inset-x-2 top-14 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2'
              : 'fixed top-3 left-[calc(var(--sidebar-w)+0.5rem)]'
          }
        />
      )}
    </div>
  );
}

function ActivityPanel(props: {
  items: NotificationDto[];
  unread: number;
  loading: boolean;
  onClose: () => void;
  className: string;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const markRead = useMarkRead();
  const navigate = useNavigate();
  const shown = props.items.filter((item) => filter === 'all' || !item.readAt);
  const groups = (['today', 'yesterday', 'earlier'] as DayGroup[])
    .map((group) => ({
      group,
      items: shown.filter((item) => dayGroupOf(item.createdAt) === group),
    }))
    .filter((entry) => entry.items.length > 0);

  const openItem = (item: NotificationDto) => {
    if (!item.readAt) markRead.mutate([item.id]);
    props.onClose();
    if (item.linkPath) navigate(item.linkPath);
  };

  return (
    <section
      aria-label={ja.nav.notifications}
      className={cn(
        'z-50 flex max-h-[min(640px,calc(100dvh-5rem))] flex-col border border-line bg-surface shadow-(--shadow-raised) sm:w-[400px]',
        props.className,
      )}
    >
      <header className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <h2 className="text-base font-bold">{ja.nav.notifications}</h2>
        <div className="ml-auto flex items-center">
          {props.unread > 0 && (
            <button
              type="button"
              onClick={() => markRead.mutate('all')}
              className="flex h-8 cursor-pointer items-center gap-1.5 px-2 text-xs font-medium text-ink-sub hover:bg-hover hover:text-ink"
            >
              <CheckCheck aria-hidden="true" className="size-4" />
              すべて既読にする
            </button>
          )}
          <button
            type="button"
            onClick={props.onClose}
            aria-label="閉じる"
            className="flex size-8 cursor-pointer items-center justify-center text-ink-sub hover:bg-hover hover:text-ink"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      </header>
      <div role="tablist" className="flex gap-1 border-b border-line px-4">
        {(['all', 'unread'] as Filter[]).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              '-mb-px cursor-pointer border-b-2 px-2 pb-2 text-sm font-medium',
              filter === value
                ? 'border-main text-ink'
                : 'border-transparent text-ink-sub hover:text-ink',
            )}
          >
            {value === 'all' ? 'すべて' : `未読${props.unread > 0 ? `（${props.unread}）` : ''}`}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!props.loading && shown.length === 0 && (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <MoraBot mood="done" size={96} title="" />
            <p className="mt-3 text-sm text-ink-sub">
              {filter === 'unread' ? '未読のお知らせはありません。' : 'お知らせはありません。'}
            </p>
          </div>
        )}
        {groups.map(({ group, items }) => (
          <div key={group}>
            <p className="sticky top-0 z-10 bg-column px-4 py-1.5 text-xs font-bold text-ink-sub">
              {DAY_GROUP_LABEL[group]}
            </p>
            <ul>
              {items.map((item) => (
                <ActivityItem key={item.id} item={item} onOpen={() => openItem(item)} />
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Link
        to={paths.notifications}
        onClick={props.onClose}
        className="flex h-11 items-center justify-center gap-1.5 border-t border-line text-sm font-bold text-link hover:bg-hover"
      >
        すべてのお知らせ（検索・アーカイブ）
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </section>
  );
}

function ActivityItem({ item, onOpen }: { item: NotificationDto; onOpen: () => void }) {
  const kind = noticeKindOf(item.noticeCode);
  const unread = !item.readAt;
  // The label is shown above, so 「新しいアポ：○○」 reads as just 「○○」.
  const title = item.title.startsWith(`${kind.label}：`)
    ? item.title.slice(kind.label.length + 1)
    : item.title;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        title={formatDateTime(item.createdAt)}
        className={cn(
          'group flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-hover',
          unread && 'bg-schedule-soft/40',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full!',
            TONE_CLASS[kind.tone],
          )}
        >
          <kind.icon className="size-[18px]" strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-xs font-medium text-ink-sub">{kind.label}</span>
            <span className="ml-auto shrink-0 text-xs text-ink-sub tabular-nums">
              {relativeTime(item.createdAt)}
            </span>
          </span>
          <span
            className={cn(
              'mt-0.5 line-clamp-2 block text-sm leading-snug',
              unread ? 'font-bold text-ink' : 'text-ink',
            )}
          >
            {title}
          </span>
          {item.body && (
            <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-ink-sub">
              {item.body}
            </span>
          )}
        </span>
        <span
          aria-label={unread ? '未読' : undefined}
          className={cn(
            'mt-2 size-2.5 shrink-0 rounded-full!',
            unread ? 'bg-schedule' : 'bg-transparent',
          )}
        />
      </button>
    </li>
  );
}
