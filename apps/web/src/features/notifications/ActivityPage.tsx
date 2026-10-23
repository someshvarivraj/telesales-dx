import type { NotificationDto } from '@telesales/shared';
import {
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  CheckCheck,
  Inbox,
  Mail,
  MailOpen,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { MoraBot } from '@/components/brand/MoraBot';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Spinner } from '@/components/ui/Spinner';
import { formatDateTime } from '@/lib/format';
import { ja } from '@/i18n/ja';
import { type NoticeBox, useArchive, useMarkRead, useMarkUnread, useNotificationFeed } from './api';
import {
  DAY_GROUP_LABEL,
  type DayGroup,
  dayGroupOf,
  NOTICE_CATEGORIES,
  noticeKindOf,
  relativeTime,
  TONE_BAR,
  TONE_CLASS,
} from './noticeKinds';

const BOXES: { value: NoticeBox; label: string; icon: typeof Inbox }[] = [
  { value: 'inbox', label: '受信箱', icon: Inbox },
  { value: 'unread', label: '未読', icon: Mail },
  { value: 'archived', label: 'アーカイブ', icon: Archive },
];

function stripLabel(item: NotificationDto): string {
  const label = noticeKindOf(item.noticeCode).label;
  return item.title.startsWith(`${label}：`) ? item.title.slice(label.length + 1) : item.title;
}

/**
 * お知らせ as an activity feed (like Microsoft Teams): inbox, unread and archive, search,
 * colour-coded type filters, a reading pane, and keyboard use (J/K move, E archive,
 * U unread, Enter open).
 */
export function ActivityPage() {
  const [box, setBox] = useState<NoticeBox>('inbox');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const navigate = useNavigate();
  const listRef = useRef<HTMLUListElement>(null);

  // Search after a short pause in typing.
  useEffect(() => {
    const id = window.setTimeout(() => setQ(search.trim()), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const codes = NOTICE_CATEGORIES.find((c) => c.key === category)?.codes ?? [];
  const feed = useNotificationFeed({ box, q, codes });
  const markRead = useMarkRead();
  const markUnread = useMarkUnread();
  const archive = useArchive();

  const items = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);
  const first = feed.data?.pages[0];
  const unreadCount = first?.unreadCount ?? 0;
  const unreadByCode = first?.unreadByCode ?? {};
  const selected = items.find((item) => item.id === selectedId) ?? null;

  const groups = (['today', 'yesterday', 'earlier'] as DayGroup[])
    .map((group) => ({
      group,
      items: items.filter((item) => dayGroupOf(item.createdAt) === group),
    }))
    .filter((entry) => entry.items.length > 0);

  const select = (item: NotificationDto) => {
    setSelectedId(item.id);
    if (!item.readAt) markRead.mutate([item.id]);
  };
  const open = (item: NotificationDto) => {
    if (!item.readAt) markRead.mutate([item.id]);
    if (item.linkPath) navigate(item.linkPath);
  };
  const toggleArchive = (item: NotificationDto) =>
    archive.mutate({ ids: [item.id], archived: !item.archivedAt });
  const toggleRead = (item: NotificationDto) =>
    item.readAt ? markUnread.mutate([item.id]) : markRead.mutate([item.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.metaKey || event.ctrlKey || target.closest('input, textarea, dialog[open]')) return;
      const index = items.findIndex((item) => item.id === selectedId);
      const move = (by: number) => {
        const next = items[Math.max(0, Math.min(items.length - 1, index + by))];
        if (next) {
          select(next);
          listRef.current
            ?.querySelector(`[data-id="${next.id}"]`)
            ?.scrollIntoView({ block: 'nearest' });
        }
      };
      const key = event.key.toLowerCase();
      if (key === 'j' || key === 'arrowdown') move(1);
      else if (key === 'k' || key === 'arrowup') move(-1);
      else if (key === 'e' && selected) toggleArchive(selected);
      else if (key === 'u' && selected) toggleRead(selected);
      else if (key === 'enter' && selected) open(selected);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="text-xs font-medium text-ink-sub">アクティビティ</p>
          <h1 className="text-2xl font-bold tracking-tight">
            {ja.nav.notifications}
            {unreadCount > 0 && (
              <span className="ml-2 align-middle text-sm font-bold text-schedule">
                未読 {unreadCount}件
              </span>
            )}
          </h1>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={<CheckCheck className="size-4" aria-hidden="true" />}
            disabled={unreadCount === 0}
            onClick={() => markRead.mutate('all')}
          >
            すべて既読にする
          </Button>
          {box !== 'archived' && (
            <Button
              variant="secondary"
              icon={<Archive className="size-4" aria-hidden="true" />}
              onClick={() => archive.mutate({ ids: 'read', archived: true })}
              loading={archive.isPending}
            >
              既読をまとめてアーカイブ
            </Button>
          )}
        </div>
      </div>

      <div className="grid min-h-[calc(100dvh-12rem)] border border-line bg-surface shadow-(--shadow-card) lg:grid-cols-[minmax(22rem,28rem)_1fr]">
        {/* Feed */}
        <section
          className="flex min-h-0 flex-col border-line lg:border-r"
          aria-label="お知らせの一覧"
        >
          <div className="flex flex-col gap-2.5 border-b border-line p-3">
            <div role="tablist" aria-label="表示" className="flex gap-1">
              {BOXES.map((option) => {
                const on = box === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => {
                      setBox(option.value);
                      setSelectedId(null);
                    }}
                    className={cn(
                      'flex h-8 cursor-pointer items-center gap-1.5 px-3 text-sm font-bold transition-colors',
                      on ? 'bg-ink text-white' : 'text-ink-sub hover:bg-column hover:text-ink',
                    )}
                  >
                    <option.icon aria-hidden="true" className="size-4" />
                    {option.label}
                    {option.value === 'unread' && unreadCount > 0 && (
                      <span
                        className={cn(
                          'min-w-5 px-1 text-center text-[11px] leading-5',
                          on ? 'bg-white/20' : 'bg-schedule text-white',
                        )}
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-sub"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="会社名・内容で検索"
                aria-label="お知らせを検索"
                className="h-9 w-full border border-line-strong bg-canvas pr-8 pl-9 text-sm placeholder:text-ink-disabled focus:border-main-focus focus:bg-surface focus:ring-3 focus:ring-main-focus/20 focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  aria-label="検索を消す"
                  onClick={() => setSearch('')}
                  className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center text-ink-sub hover:text-ink"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              )}
            </div>
            <div
              className="scroll-quiet -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5"
              aria-label="種類で絞り込む"
            >
              <button
                type="button"
                aria-pressed={category === null}
                onClick={() => setCategory(null)}
                className={cn(
                  'h-7 shrink-0 cursor-pointer border px-2.5 text-xs font-bold',
                  category === null
                    ? 'border-ink bg-ink text-white'
                    : 'border-line text-ink-sub hover:text-ink',
                )}
              >
                すべて
              </button>
              {NOTICE_CATEGORIES.map((c) => {
                const on = category === c.key;
                const count = c.codes.reduce((sum, code) => sum + (unreadByCode[code] ?? 0), 0);
                return (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setCategory(on ? null : c.key)}
                    className={cn(
                      'flex h-7 shrink-0 cursor-pointer items-center gap-1.5 border px-2 text-xs font-bold transition-colors',
                      on
                        ? cn('border-transparent', TONE_CLASS[c.tone])
                        : 'border-line text-ink-sub hover:text-ink',
                    )}
                  >
                    <span aria-hidden="true" className={cn('size-2', TONE_BAR[c.tone])} />
                    {c.label}
                    {count > 0 && <span className="tabular-nums opacity-80">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto lg:max-h-[calc(100dvh-20rem)]">
            {feed.isPending && (
              <div className="flex justify-center py-12 text-ink-sub">
                <Spinner className="size-6" label={ja.common.loading} />
              </div>
            )}
            {!feed.isPending && items.length === 0 && (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <MoraBot mood="approved" size={96} title="" />
                <p className="mt-3 text-sm text-ink-sub">
                  {q || category
                    ? '条件に合うお知らせはありません。'
                    : box === 'archived'
                      ? 'アーカイブしたお知らせはありません。'
                      : box === 'unread'
                        ? '未読のお知らせはありません。'
                        : 'お知らせはありません。'}
                </p>
              </div>
            )}
            <ul ref={listRef}>
              {groups.map(({ group, items: groupItems }) => (
                <li key={group}>
                  <p className="sticky top-0 z-10 border-b border-line bg-column/95 px-4 py-1.5 text-[11px] font-bold tracking-wide text-ink-sub backdrop-blur-sm">
                    {DAY_GROUP_LABEL[group]}
                  </p>
                  <ul>
                    {groupItems.map((item) => (
                      <FeedItem
                        key={item.id}
                        item={item}
                        selected={item.id === selectedId}
                        onSelect={() => select(item)}
                        onOpen={() => open(item)}
                        onArchive={() => toggleArchive(item)}
                        onToggleRead={() => toggleRead(item)}
                      />
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            {feed.hasNextPage && (
              <div className="p-3">
                <Button
                  variant="secondary"
                  fullWidth
                  loading={feed.isFetchingNextPage}
                  onClick={() => void feed.fetchNextPage()}
                >
                  さらに読み込む
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Reading pane */}
        <section className="hidden min-h-0 flex-col lg:flex" aria-label="お知らせの内容">
          {selected ? (
            <Detail
              item={selected}
              onOpen={() => open(selected)}
              onArchive={() => toggleArchive(selected)}
              onToggleRead={() => toggleRead(selected)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center text-ink-sub">
              <MoraBot mood="explain" size={112} title="" />
              <p className="text-sm">左の一覧からお知らせを選ぶと、ここに内容が出ます。</p>
              <p className="text-xs">
                <Kbd>J</Kbd> <Kbd>K</Kbd> で移動 · <Kbd>E</Kbd> アーカイブ · <Kbd>U</Kbd> 未読に戻す
                · <Kbd>Enter</Kbd> 開く
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="border border-line-strong bg-column px-1.5 text-[11px] font-bold">
      {children}
    </kbd>
  );
}

function FeedItem({
  item,
  selected,
  onSelect,
  onOpen,
  onArchive,
  onToggleRead,
}: {
  item: NotificationDto;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onArchive: () => void;
  onToggleRead: () => void;
}) {
  const kind = noticeKindOf(item.noticeCode);
  const unread = !item.readAt;
  return (
    <li data-id={item.id} className="group relative border-b border-line/70">
      <button
        type="button"
        onClick={() => (window.matchMedia?.('(min-width: 1024px)').matches ? onSelect() : onOpen())}
        onDoubleClick={onOpen}
        title={formatDateTime(item.createdAt)}
        className={cn(
          'flex w-full cursor-pointer items-start gap-3 py-3 pr-4 pl-4 text-left transition-colors',
          selected
            ? 'bg-main-soft'
            : unread
              ? 'bg-schedule-soft/35 hover:bg-hover'
              : 'hover:bg-hover',
        )}
      >
        {selected && (
          <span
            aria-hidden="true"
            className={cn('absolute inset-y-0 left-0 w-[3px]', TONE_BAR[kind.tone])}
          />
        )}
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex size-9 shrink-0 items-center justify-center',
            TONE_CLASS[kind.tone],
          )}
        >
          <kind.icon className="size-[18px]" strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span
              className={cn('truncate text-[11px] font-bold', unread ? 'text-ink' : 'text-ink-sub')}
            >
              {kind.label}
            </span>
            <span className="ml-auto shrink-0 text-[11px] text-ink-sub tabular-nums group-hover:invisible">
              {relativeTime(item.createdAt)}
            </span>
          </span>
          <span
            className={cn(
              'mt-0.5 line-clamp-2 block text-sm leading-snug',
              unread ? 'font-bold' : 'text-ink',
            )}
          >
            {stripLabel(item)}
          </span>
          {item.body && (
            <span className="mt-0.5 line-clamp-1 block text-xs text-ink-sub">{item.body}</span>
          )}
        </span>
        <span
          aria-label={unread ? '未読' : undefined}
          className={cn('mt-2 size-2 shrink-0', unread ? 'bg-schedule' : 'bg-transparent')}
        />
      </button>
      {/* Hover actions, as in Teams */}
      <div className="absolute top-2 right-3 hidden items-center border border-line bg-surface shadow-sm group-focus-within:flex group-hover:flex">
        <IconAction label={unread ? '既読にする' : '未読に戻す'} onClick={onToggleRead}>
          {unread ? <MailOpen className="size-4" /> : <Mail className="size-4" />}
        </IconAction>
        <IconAction label={item.archivedAt ? '受信箱に戻す' : 'アーカイブ'} onClick={onArchive}>
          {item.archivedAt ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
        </IconAction>
      </div>
    </li>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-7 cursor-pointer items-center justify-center text-ink-sub hover:bg-column hover:text-ink"
    >
      {children}
    </button>
  );
}

function Detail({
  item,
  onOpen,
  onArchive,
  onToggleRead,
}: {
  item: NotificationDto;
  onOpen: () => void;
  onArchive: () => void;
  onToggleRead: () => void;
}) {
  const kind = noticeKindOf(item.noticeCode);
  return (
    <article className="fade-in flex flex-col">
      <div className={cn('h-1', TONE_BAR[kind.tone])} />
      <header className="flex items-start gap-4 border-b border-line px-8 py-6">
        <span
          aria-hidden="true"
          className={cn('flex size-12 shrink-0 items-center justify-center', TONE_CLASS[kind.tone])}
        >
          <kind.icon className="size-6" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-ink-sub">
            {kind.label} · {formatDateTime(item.createdAt)}
            {item.archivedAt && <span className="ml-2 bg-column px-1.5">アーカイブ済み</span>}
          </p>
          <h2 className="mt-1 text-xl leading-snug font-bold">{stripLabel(item)}</h2>
        </div>
      </header>
      {item.body && (
        <p className="border-b border-line px-8 py-5 text-[15px] leading-relaxed whitespace-pre-wrap">
          {item.body}
        </p>
      )}
      <div className="flex flex-wrap gap-2 px-8 py-5">
        {item.linkPath && (
          <Button icon={<ArrowUpRight className="size-4" aria-hidden="true" />} onClick={onOpen}>
            開く
          </Button>
        )}
        <Button
          variant="secondary"
          icon={
            item.readAt ? (
              <Mail className="size-4" aria-hidden="true" />
            ) : (
              <MailOpen className="size-4" aria-hidden="true" />
            )
          }
          onClick={onToggleRead}
        >
          {item.readAt ? '未読に戻す' : '既読にする'}
        </Button>
        <Button
          variant="secondary"
          icon={
            item.archivedAt ? (
              <ArchiveRestore className="size-4" aria-hidden="true" />
            ) : (
              <Archive className="size-4" aria-hidden="true" />
            )
          }
          onClick={onArchive}
        >
          {item.archivedAt ? '受信箱に戻す' : 'アーカイブ'}
        </Button>
      </div>
    </article>
  );
}
