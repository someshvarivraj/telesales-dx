import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, Send, X } from 'lucide-react';
import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { MoraBot } from '@/components/brand/MoraBot';
import { cn } from '@/components/ui/cn';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { apiClient } from '@/lib/api/ApiClient';
import { ApiError } from '@/lib/api/ApiError';
import { errorMessageOf } from '@/lib/api/errorMessage';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  '今日やることは？',
  '自分の今週の予定は？',
  '明日の前日確認は何件？',
  'アポの登録のしかたを教えて',
  '新規リストの取り込み方は？',
];

/** Sent with each question: the most recent turns only (the server caps it at 20). */
const HISTORY = 12;

function useAssistantStatus() {
  return useQuery({
    queryKey: ['assistant', 'status'],
    queryFn: ({ signal }) => apiClient.get<{ enabled: boolean }>('/assistant/status', signal),
    staleTime: 5 * 60_000,
  });
}

/** MoraBot's own words for the failures people will actually meet. */
function assistantError(error: unknown): string {
  if (ApiError.isApiError(error)) {
    if (error.code === 'RATE_LIMITED') {
      return '質問が続いたため、少しお休みしています。15分ほどおいてから、もう一度お試しください。';
    }
    const reason = (error.details as { reason?: string } | undefined)?.reason;
    if (reason === 'assistant_unavailable') {
      return 'ただいまMoraBotが混み合っています。少し時間をおいて、もう一度お試しください。';
    }
  }
  return errorMessageOf(error);
}

/** In-app links only: `[画面名](/path)` becomes a button; anything else stays text. */
const LINK = /\[([^\]\n]{1,40})\]\((\/(?!\/)[\w\-/?=&.%]*)\)/g;

function Reply({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const [whole, label = '', to = '/'] = match;
    parts.push(text.slice(last, match.index));
    parts.push(
      <Link
        key={`${match.index}-${to}`}
        to={to}
        className="mx-0.5 inline-flex items-center gap-1 border border-main-line bg-main-soft px-1.5 py-0.5 text-xs font-bold text-main hover:bg-main hover:text-white"
      >
        {label}
        <ArrowRight aria-hidden="true" className="size-3" />
      </Link>,
    );
    last = match.index + whole.length;
  }
  parts.push(text.slice(last));
  return (
    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
      {parts.map((part, i) => (
        // Plain text pieces have no identity of their own; markdown bold is shown plainly.
        <Fragment key={i}>{typeof part === 'string' ? part.replace(/\*\*/g, '') : part}</Fragment>
      ))}
    </p>
  );
}

/**
 * MoraBot assistant: a chat panel from the bottom-right corner on every screen. It
 * answers how-to questions from the manual and looks up schedules and appointments
 * as the signed-in user. Hidden when the server has no AI key.
 */
export function AssistantWidget() {
  const status = useAssistantStatus();
  const { name } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const ask = useMutation({
    mutationFn: (history: Turn[]) =>
      apiClient.post<{ reply: string }>('/assistant/chat', { messages: history.slice(-HISTORY) }),
    onSuccess: (data) =>
      setTurns((current) => [...current, { role: 'assistant', content: data.reply }]),
  });

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [turns, ask.isPending, open]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  if (!status.data?.enabled) return null;

  const send = (text: string) => {
    const question = text.trim();
    if (!question || ask.isPending) return;
    const next: Turn[] = [...turns, { role: 'user', content: question }];
    setTurns(next);
    setDraft('');
    ask.mutate(next);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="MoraBotに聞く"
          className="assistant-launcher fixed right-4 bottom-20 z-40 flex cursor-pointer items-center gap-2 border border-main-line bg-surface py-1.5 pr-4 pl-2 shadow-(--shadow-raised) hover:bg-main-soft md:right-6 md:bottom-6"
        >
          <MoraBot headOnly size={34} title="" />
          <span className="text-sm font-bold text-main max-sm:hidden">MoraBotに聞く</span>
        </button>
      )}
      {open && (
        <section
          aria-label="MoraBot アシスタント"
          className="pop-in fixed inset-x-2 bottom-20 z-40 flex h-[min(600px,75dvh)] flex-col border border-line bg-surface shadow-(--shadow-raised) [--pop-origin:bottom_right] md:inset-x-auto md:right-6 md:bottom-6 md:w-[400px]"
        >
          <header className="flex items-center gap-3 border-b border-line border-t-4 border-t-main px-4 py-2.5">
            <MoraBot mood="guide" size={44} title="" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">MoraBot</p>
              <p className="truncate text-[11px] text-ink-sub">
                使い方・予定・アポのことをお調べします
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="閉じる"
              className="flex size-8 cursor-pointer items-center justify-center text-ink-sub hover:bg-hover hover:text-ink"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </header>

          <div className="scroll-quiet flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
            <div className="mb-3 bg-column px-3 py-2.5">
              <p className="text-sm leading-relaxed">
                {name}
                さん、おつかれさまです。使い方や、今日の予定・アポのことなど、お気軽にお聞きください。
              </p>
              {turns.length === 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => send(suggestion)}
                      className="cursor-pointer border border-main-line bg-surface px-2.5 py-1 text-xs font-bold text-main hover:bg-main-soft"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ul className="flex flex-col gap-3">
              {turns.map((turn, i) => (
                <li
                  key={i}
                  className={cn(
                    'max-w-[88%] px-3 py-2',
                    turn.role === 'user'
                      ? 'self-end bg-main text-sm whitespace-pre-wrap text-white'
                      : 'self-start border border-line bg-surface',
                  )}
                >
                  {turn.role === 'user' ? turn.content : <Reply text={turn.content} />}
                </li>
              ))}
              {ask.isPending && (
                <li className="flex items-center gap-2 self-start text-xs text-ink-sub">
                  <MoraBot mood="think" size={36} animate title="" />
                  お調べしています…
                </li>
              )}
              {ask.isError && (
                <li className="self-start border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
                  {assistantError(ask.error)}
                </li>
              )}
            </ul>
            <div ref={bottom} />
          </div>

          <form
            className="flex items-end gap-2 border-t border-line p-2.5"
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
          >
            <textarea
              ref={input}
              value={draft}
              rows={1}
              maxLength={2000}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends; Shift+Enter is a new line; never while the IME is composing.
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  send(draft);
                }
              }}
              placeholder="質問を入力（例：明日の千原さんの予定は？）"
              aria-label="MoraBotへの質問"
              className="max-h-28 min-h-10 flex-1 resize-none border border-line-strong px-3 py-2 text-sm focus:border-main-focus focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim() || ask.isPending}
              aria-label="送信"
              className="flex size-10 shrink-0 cursor-pointer items-center justify-center bg-main text-white hover:bg-main-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send aria-hidden="true" className="size-4" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
