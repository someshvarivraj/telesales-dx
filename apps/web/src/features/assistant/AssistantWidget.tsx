import {
  type AssistantMessageDto,
  type AssistantStep,
  type ErrorCode,
  ErrorCode as ErrorCodes,
  Permission,
} from '@telesales/shared';
import {
  BookOpen,
  CalendarPlus,
  ClipboardPen,
  Clock,
  Handshake,
  History,
  ListChecks,
  type LucideIcon,
  Maximize2,
  Minimize2,
  Plus,
  Send,
  Square,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { MoraBot } from '@/components/brand/MoraBot';
import { cn } from '@/components/ui/cn';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { ApiError } from '@/lib/api/ApiError';
import { errorMessageOf } from '@/lib/api/errorMessage';
import {
  fetchConversation,
  streamChat,
  useAssistantStatus,
  useDecision,
  useRefreshHistory,
} from './api';
import { HistoryPane } from './HistoryPane';
import { LeaveContext } from './leave';
import {
  ActionCard,
  AssistantRow,
  EventLine,
  OpenedScreen,
  QuestionCard,
  Reply,
  StepTrail,
  UserBubble,
} from './parts';

type Mode = 'closed' | 'panel' | 'full';

/** Keys for messages shown before the server has saved them. */
let pendingCount = 0;
function nextPendingId(): string {
  pendingCount += 1;
  return `pending-${pendingCount}`;
}

/** Per-person conveniences only (the conversation itself is kept on the server). */
function remembered(userId: string) {
  const key = `telesales.assistant.${userId}`;
  return {
    read(): { conversationId: string | null } {
      try {
        const raw = window.localStorage.getItem(key);
        return raw
          ? (JSON.parse(raw) as { conversationId: string | null })
          : { conversationId: null };
      } catch {
        return { conversationId: null };
      }
    },
    write(value: { conversationId: string | null }) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Private windows can refuse storage; MoraBot still works, it just starts fresh.
      }
    },
  };
}

/** MoraBot's own words for the failures people will actually meet. */
function chatError(error: unknown): string {
  if (ApiError.isApiError(error)) {
    if (error.code === ErrorCodes.RateLimited) {
      return 'お願いが続いたため、少しお休みしています。15分ほどおいてから、もう一度お試しください。';
    }
    const reason = (error.details as { reason?: string } | undefined)?.reason;
    if (reason === 'assistant_unavailable') {
      return 'ただいまMoraBotが混み合っています。少し時間をおいて、もう一度お試しください。';
    }
  }
  return errorMessageOf(error);
}

interface Task {
  icon: LucideIcon;
  title: string;
  prompt: string;
  show: boolean;
}

/**
 * MoraBot: a work partner docked beside every screen. It looks things up, asks with
 * choices, opens screens, and prepares registrations as cards that run only on 確定.
 * Conversations and everything it did are kept, so people can look back.
 */
export function AssistantWidget() {
  const status = useAssistantStatus();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const memory = useMemo(() => remembered(user.id), [user.id]);
  const canTelema = usePermission(Permission.ManageTelemaAppointments);
  const canSales = usePermission(Permission.ManageSalesAppointments);
  const canPlans = usePermission(Permission.WriteSalesPlans);
  const canCalls = usePermission(Permission.WriteCallRecords);

  const [mode, setMode] = useState<Mode>('closed');
  const [showHistory, setShowHistory] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(
    () => memory.read().conversationId,
  );
  const [messages, setMessages] = useState<AssistantMessageDto[]>([]);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [live, setLive] = useState<AssistantStep[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [draft, setDraft] = useState('');
  const [deciding, setDeciding] = useState<string | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, unknown>>({});
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const decision = useDecision();
  const refreshHistory = useRefreshHistory();
  const working = live !== null;
  const open = mode !== 'closed';

  const remember = useCallback(
    (id: string | null) => {
      setConversationId(id);
      memory.write({ conversationId: id });
    },
    [memory],
  );

  // Bring back the last conversation the first time the panel opens.
  useEffect(() => {
    if (!open || !conversationId || loaded === conversationId || working) return;
    let cancelled = false;
    fetchConversation(conversationId)
      .then((conversation) => {
        if (cancelled) return;
        setMessages(conversation.messages);
        setLoaded(conversation.id);
      })
      .catch(() => {
        if (cancelled) return;
        remember(null);
        setMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, conversationId, loaded, working, remember]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages, live, mode]);

  useEffect(() => {
    if (open && !showHistory) input.current?.focus();
  }, [open, showHistory, conversationId]);

  // Ctrl/⌘+K opens MoraBot from anywhere; Esc leaves the full view.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setMode((current) => (current === 'closed' ? 'panel' : 'closed'));
      } else if (event.key === 'Escape' && mode === 'full') {
        setMode('panel');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  // The docked panel takes room beside the page instead of covering it (wide screens).
  useEffect(() => {
    document.body.dataset.assistant = mode;
    return () => {
      delete document.body.dataset.assistant;
    };
  }, [mode]);

  if (!status.data?.enabled) return null;

  /** Open a screen for the person; from the full view, step aside so they can see it. */
  const goTo = (path: string) => {
    void navigate(path);
    setMode((current) => (current === 'full' ? 'panel' : current));
  };

  /**
   * The person follows a link to a screen: MoraBot steps aside so the screen is what they
   * see (the conversation is kept; the launcher or Ctrl+K brings it back).
   */
  const leave = () => setMode('closed');

  const send = (text: string) => {
    const message = text.trim();
    if (!message || working) return;
    setDraft('');
    setError(null);
    setShowHistory(false);
    setLive([]);
    const controller = new AbortController();
    abort.current = controller;
    // Shown at once; replaced by the saved copy when the server echoes it.
    const pendingId = nextPendingId();
    setMessages((current) => [
      ...current,
      {
        id: pendingId,
        role: 'user',
        content: message,
        steps: [],
        question: null,
        openedPath: null,
        actions: [],
        createdAt: new Date().toISOString(),
      },
    ]);
    streamChat(
      { conversationId, message, path: location.pathname + location.search },
      (event) => {
        switch (event.type) {
          case 'conversation':
            if (event.id !== conversationId) {
              remember(event.id);
              setLoaded(event.id);
            }
            break;
          case 'user':
            setMessages((current) =>
              current.map((item) => (item.id === pendingId ? event.message : item)),
            );
            break;
          case 'step':
            setLive((current) => [...(current ?? []), event.step]);
            break;
          case 'message':
            setMessages((current) => [...current, event.message]);
            if (event.message.openedPath) goTo(event.message.openedPath);
            break;
          case 'error':
            setError(new ApiError(0, event.code as ErrorCode, {}, { reason: event.reason }));
            break;
        }
      },
      controller.signal,
    )
      .catch((failure: unknown) => {
        if (!(failure instanceof DOMException && failure.name === 'AbortError')) setError(failure);
      })
      .finally(() => {
        setLive(null);
        abort.current = null;
        refreshHistory();
      });
  };

  const decide = (actionId: string, choice: 'confirm' | 'dismiss') => {
    setDeciding(actionId);
    setCardErrors((current) => ({ ...current, [actionId]: null }));
    decision.mutate(
      { id: actionId, decision: choice },
      {
        onSuccess: ({ action, message }) => {
          setMessages((current) => [
            ...current.map((item) => ({
              ...item,
              actions: item.actions.map((existing) =>
                existing.id === action.id ? action : existing,
              ),
            })),
            message,
          ]);
          // A booking continues on its screen: the held slot, or the N1 mail after registering.
          if (
            choice === 'confirm' &&
            action.resultLink &&
            (action.kind === 'booking' || action.kind === 'appointment')
          ) {
            void navigate(action.resultLink);
            leave();
          }
        },
        onError: (failure) => setCardErrors((current) => ({ ...current, [actionId]: failure })),
        onSettled: () => setDeciding(null),
      },
    );
  };

  const startNew = () => {
    abort.current?.abort();
    remember(null);
    setMessages([]);
    setLoaded(null);
    setError(null);
    setShowHistory(false);
  };

  const openConversation = (id: string) => {
    abort.current?.abort();
    setMessages([]);
    setLoaded(null);
    setError(null);
    remember(id);
    setShowHistory(false);
  };

  const tasks: Task[] = [
    {
      icon: Handshake,
      title: 'アポを登録する',
      prompt: '新規リストの会社のアポを登録したいです',
      show: canTelema || canSales,
    },
    {
      icon: Clock,
      title: '空き時間を探す',
      prompt: '担当営業の明日の空き時間を教えてください',
      show: true,
    },
    {
      icon: CalendarPlus,
      title: '予定を入れる',
      prompt: '来週火曜の10時から1時間、自分の予定を入れてください',
      show: canPlans,
    },
    {
      icon: ClipboardPen,
      title: '架電結果を入れる',
      prompt: '架電結果を入れたいです',
      show: canCalls,
    },
    { icon: ListChecks, title: '今日やること', prompt: '今日やることを教えてください', show: true },
    {
      icon: BookOpen,
      title: '使い方を聞く',
      prompt: '前日確認のやり方を教えてください',
      show: true,
    },
  ];

  // A question is answered by the next thing the person says.
  const answerOf = (index: number): string | null =>
    messages.slice(index + 1).find((item) => item.role === 'user')?.content ?? null;

  const statusLine = working
    ? (live.at(-1)?.text ?? 'ご依頼の内容を読み取っています…')
    : 'お調べ・予定やアポの準備・画面の案内をいたします';

  const conversation = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div
          className={cn(
            'mx-auto flex flex-col gap-5 px-4 py-5',
            mode === 'full' && 'max-w-3xl px-6',
          )}
        >
          {messages.length === 0 && !working ? (
            <div className="assistant-in flex flex-col items-center pt-4 text-center">
              <MoraBot mood="guide" size={mode === 'full' ? 150 : 120} animate title="" />
              <h2 className="mt-3 text-lg font-bold">
                {user.name}さん、おつかれさまです。
                <br />
                何をお手伝いしましょうか？
              </h2>
              <p className="mt-1.5 max-w-sm text-sm text-ink-sub">
                調べものから登録の準備まで、代わりに進めます。登録は、内容をお見せして「確定」をいただいてから行います。
              </p>
              <div
                className={cn(
                  'mt-5 grid w-full gap-2 text-left',
                  mode === 'full' ? 'grid-cols-3' : 'grid-cols-2',
                )}
              >
                {tasks
                  .filter((task) => task.show)
                  .map((task) => (
                    <button
                      key={task.title}
                      type="button"
                      onClick={() => send(task.prompt)}
                      className="group flex cursor-pointer flex-col gap-1.5 border border-line bg-surface p-3 transition-colors hover:border-main hover:bg-main-soft"
                    >
                      <span className="flex size-8 items-center justify-center bg-main-soft text-main transition-colors group-hover:bg-main group-hover:text-white">
                        <task.icon aria-hidden="true" className="size-4" />
                      </span>
                      <span className="text-sm font-bold">{task.title}</span>
                      <span className="line-clamp-2 text-[11px] text-ink-sub">
                        「{task.prompt}」
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => {
              if (message.role === 'user') return <UserBubble key={message.id} message={message} />;
              if (message.role === 'event') return <EventLine key={message.id} message={message} />;
              const latest = index === messages.length - 1;
              return (
                <AssistantRow key={message.id} mood={message.actions.length ? 'happy' : 'guide'}>
                  <StepTrail steps={message.steps} />
                  <Reply text={message.content} />
                  {message.question && (
                    <QuestionCard
                      question={message.question}
                      answer={answerOf(index)}
                      disabled={working || !latest}
                      onChoose={send}
                      onOther={() => input.current?.focus()}
                    />
                  )}
                  {message.actions.map((action) => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      busy={deciding === action.id}
                      error={cardErrors[action.id] ?? null}
                      onConfirm={() => decide(action.id, 'confirm')}
                      onDismiss={() => decide(action.id, 'dismiss')}
                    />
                  ))}
                  {message.openedPath && <OpenedScreen path={message.openedPath} />}
                </AssistantRow>
              );
            })
          )}
          {working && (
            <AssistantRow mood="think" working>
              <p className="mb-2 text-sm font-bold text-main">お任せください。作業しています…</p>
              <StepTrail steps={live} working />
            </AssistantRow>
          )}
          {error !== null && !working && (
            <p role="alert" className="assistant-in bg-danger-soft px-3 py-2.5 text-sm text-danger">
              {chatError(error)}
            </p>
          )}
          <div ref={bottom} />
        </div>
      </div>

      <form
        className={cn(
          'border-t border-line bg-surface px-3 pt-3 pb-2.5',
          mode === 'full' && 'px-6',
        )}
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <div className={cn('mx-auto', mode === 'full' && 'max-w-3xl')}>
          <div className="flex items-end gap-2 border border-line-strong bg-surface p-1.5 focus-within:border-main-focus focus-within:shadow-[0_0_0_3px_var(--color-main-soft)]">
            <textarea
              ref={input}
              value={draft}
              rows={2}
              maxLength={2000}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends; Shift+Enter is a new line; never while the IME is composing.
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  send(draft);
                }
              }}
              placeholder="MoraBotにお願いする（例：〇〇工業のアポを来週水曜14時で登録して）"
              aria-label="MoraBotへのお願い"
              className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] focus:outline-none"
            />
            {working ? (
              <button
                type="button"
                onClick={() => abort.current?.abort()}
                aria-label="止める"
                className="flex size-10 shrink-0 cursor-pointer items-center justify-center border border-line-strong text-ink-sub hover:bg-hover"
              >
                <Square aria-hidden="true" className="size-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="送信"
                className="flex size-10 shrink-0 cursor-pointer items-center justify-center bg-main text-white hover:bg-main-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send aria-hidden="true" className="size-4" />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-center text-[11px] text-ink-sub">
            Enterで送信・Shift+Enterで改行・登録や送信は、必ず「確定」を押してから行われます
          </p>
        </div>
      </form>
    </div>
  );

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setMode('panel')}
          aria-label="MoraBotにおまかせ（Ctrl+K）"
          className="assistant-launcher group fixed right-4 bottom-20 z-40 flex cursor-pointer items-center border border-main-line bg-surface p-2 shadow-(--shadow-raised) transition-colors duration-150 hover:border-main hover:bg-main-soft focus-visible:border-main md:right-6 md:bottom-6"
        >
          <MoraBot headOnly size={42} title="" />
          {/* Only MoraBot's head until pointed at; then the label slides open (not on phones). */}
          <span className="grid grid-cols-[0fr] transition-[grid-template-columns] duration-200 ease-out max-sm:hidden group-hover:grid-cols-[1fr] group-focus-visible:grid-cols-[1fr] motion-reduce:transition-none">
            <span className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
              <span className="pl-3 text-left">
                <span className="block text-sm font-bold text-main">MoraBotにおまかせ</span>
                <span className="block text-[11px] text-ink-sub">
                  調べもの・登録の準備・画面案内
                </span>
              </span>
              <kbd className="mr-2 border border-line px-1.5 py-0.5 font-sans text-[10px] text-ink-sub max-md:hidden">
                Ctrl K
              </kbd>
            </span>
          </span>
        </button>
      )}

      {open && (
        <LeaveContext value={leave}>
          <section
            aria-label="MoraBot"
            className={cn(
              'assistant-shell fixed z-50 flex flex-col overflow-hidden bg-surface shadow-(--shadow-raised)',
              mode === 'full'
                ? 'inset-0 md:inset-4 md:border md:border-line'
                : 'inset-y-0 right-0 w-full border-l border-line sm:w-[480px]',
            )}
          >
            <header className="assistant-header relative flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
              <div className="relative">
                <MoraBot mood={working ? 'think' : 'guide'} size={52} animate={working} title="" />
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute right-0 bottom-1 size-3 border-2 border-surface',
                    working ? 'animate-pulse bg-warning' : 'bg-success',
                  )}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold">MoraBot</p>
                <p
                  className={cn(
                    'truncate text-xs',
                    working ? 'font-bold text-main' : 'text-ink-sub',
                  )}
                >
                  {statusLine}
                </p>
              </div>
              <div className="flex items-center gap-0.5">
                <HeaderButton label="新しい会話" onClick={startNew} icon={Plus} />
                {mode === 'panel' && (
                  <HeaderButton
                    label="履歴"
                    onClick={() => setShowHistory((value) => !value)}
                    icon={History}
                    active={showHistory}
                  />
                )}
                <HeaderButton
                  label={mode === 'full' ? '横に並べる' : '大きく開く'}
                  onClick={() => setMode(mode === 'full' ? 'panel' : 'full')}
                  icon={mode === 'full' ? Minimize2 : Maximize2}
                  className="max-sm:hidden"
                />
                <HeaderButton label="閉じる（Ctrl+K）" onClick={() => setMode('closed')} icon={X} />
              </div>
            </header>

            <div className="flex min-h-0 flex-1">
              {mode === 'full' && (
                <HistoryPane
                  currentId={conversationId}
                  onOpen={openConversation}
                  onNew={startNew}
                  className="w-72 shrink-0 border-r border-line max-md:hidden"
                />
              )}
              {mode === 'panel' && showHistory ? (
                <HistoryPane
                  currentId={conversationId}
                  onOpen={openConversation}
                  onNew={startNew}
                  onClose={() => setShowHistory(false)}
                  className="flex-1"
                />
              ) : (
                conversation
              )}
            </div>
          </section>
        </LeaveContext>
      )}
    </>
  );
}

function HeaderButton({
  label,
  onClick,
  icon: Icon,
  active = false,
  className,
}: {
  label: string;
  onClick: () => void;
  icon: LucideIcon;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      className={cn(
        'flex size-9 cursor-pointer items-center justify-center text-ink-sub hover:bg-hover hover:text-ink',
        active && 'bg-main-soft text-main',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4.5" />
    </button>
  );
}
