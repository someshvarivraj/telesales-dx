import type { AssistantConversationSummary } from '@telesales/shared';
import { ArrowRight, Check, MessageSquare, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/components/ui/cn';
import { formatDateTime } from '@/lib/format';
import { useActionHistory, useConversations, useDeleteConversation } from './api';
import { screenName } from './parts';

const DAY_MS = 86_400_000;

/** 今日 / 昨日 / この7日 / それ以前, by the conversation's last activity. */
function groupOf(updatedAt: string, now: Date): string {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const at = new Date(updatedAt).getTime();
  if (at >= start.getTime()) return '今日';
  if (at >= start.getTime() - DAY_MS) return '昨日';
  if (at >= start.getTime() - 6 * DAY_MS) return 'この7日間';
  return 'それ以前';
}

function grouped(rows: AssistantConversationSummary[]) {
  const now = new Date();
  const groups = new Map<string, AssistantConversationSummary[]>();
  for (const row of rows) {
    const key = groupOf(row.updatedAt, now);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()];
}

/** Past conversations and everything MoraBot did, so people can look back. */
export function HistoryPane({
  currentId,
  onOpen,
  onNew,
  onClose,
  className,
}: {
  currentId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  /** Shown in the narrow panel, where the history covers the chat. */
  onClose?: () => void;
  className?: string;
}) {
  const [tab, setTab] = useState<'chats' | 'actions'>('chats');
  const conversations = useConversations(tab === 'chats');
  const actions = useActionHistory(tab === 'actions');
  const remove = useDeleteConversation();

  return (
    <aside className={cn('flex min-h-0 flex-col bg-column', className)} aria-label="MoraBotの履歴">
      <div className="flex items-center gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={onNew}
          className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 bg-main px-3 py-2 text-sm font-bold text-white hover:bg-main-hover"
        >
          <Plus aria-hidden="true" className="size-4" />
          新しい会話
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="履歴を閉じる"
            className="flex size-9 cursor-pointer items-center justify-center text-ink-sub hover:bg-hover"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
      <div role="tablist" className="mx-3 mt-3 grid grid-cols-2 border border-line bg-surface">
        {(
          [
            ['chats', '会話'],
            ['actions', '実行した操作'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'cursor-pointer py-1.5 text-xs font-bold',
              tab === key ? 'bg-main-soft text-main' : 'text-ink-sub hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="scroll-quiet mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {tab === 'chats' &&
          (conversations.isLoading ? (
            <Spinner className="mx-auto mt-8 size-5" label="読み込み中" />
          ) : conversations.data?.length ? (
            grouped(conversations.data).map(([label, rows]) => (
              <section key={label} className="mt-3">
                <h3 className="px-1 text-[11px] font-bold text-ink-sub">{label}</h3>
                <ul className="mt-1 space-y-0.5">
                  {rows.map((row) => (
                    <li key={row.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => onOpen(row.id)}
                        className={cn(
                          'flex w-full cursor-pointer items-start gap-2 px-2 py-2 pr-8 text-left',
                          row.id === currentId ? 'bg-surface shadow-sm' : 'hover:bg-surface',
                        )}
                      >
                        <MessageSquare
                          aria-hidden="true"
                          className="mt-0.5 size-3.5 shrink-0 text-ink-sub"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{row.title}</span>
                          {row.actionCount > 0 && (
                            <span className="mt-0.5 flex items-center gap-1 text-[11px] text-success">
                              <Check aria-hidden="true" className="size-3" />
                              {row.actionCount}件を実行
                            </span>
                          )}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`「${row.title}」を削除`}
                        onClick={() => {
                          if (
                            window.confirm(
                              'この会話を削除しますか？（実行した操作の記録も消えます）',
                            )
                          ) {
                            remove.mutate(row.id, {
                              onSuccess: () => {
                                if (row.id === currentId) onNew();
                              },
                            });
                          }
                        }}
                        className="absolute top-1.5 right-1 hidden size-7 cursor-pointer items-center justify-center text-ink-sub group-hover:flex hover:text-danger focus-visible:flex"
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <p className="mt-8 text-center text-sm text-ink-sub">まだ会話はありません。</p>
          ))}

        {tab === 'actions' &&
          (actions.isLoading ? (
            <Spinner className="mx-auto mt-8 size-5" label="読み込み中" />
          ) : actions.data?.length ? (
            <ul className="mt-2 space-y-2">
              {actions.data.map((action) => (
                <li key={action.id} className="border border-line bg-surface px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'px-1.5 py-0.5 text-[10px] font-bold',
                        action.status === 'DONE'
                          ? 'bg-success-soft text-success'
                          : action.status === 'DISMISSED'
                            ? 'bg-column text-ink-sub'
                            : 'bg-warning-soft text-warning-ink',
                      )}
                    >
                      {action.status === 'DONE'
                        ? '確定'
                        : action.status === 'DISMISSED'
                          ? '取りやめ'
                          : '未確定'}
                    </span>
                    <span className="text-sm font-bold">{action.title}</span>
                    <span className="ml-auto text-[11px] text-ink-sub">
                      {formatDateTime(action.decidedAt ?? action.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-sub">
                    {action.lines
                      .slice(0, 3)
                      .map((line) => line.value)
                      .join('／')}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => onOpen(action.conversationId)}
                      className="cursor-pointer text-ink-sub hover:text-main"
                    >
                      会話を見る
                    </button>
                    {action.resultLink && (
                      <Link
                        to={action.resultLink}
                        className="flex items-center gap-0.5 text-main hover:underline"
                      >
                        {screenName(action.resultLink)}
                        <ArrowRight aria-hidden="true" className="size-3" />
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 text-center text-sm text-ink-sub">まだ実行した操作はありません。</p>
          ))}
      </div>
    </aside>
  );
}
