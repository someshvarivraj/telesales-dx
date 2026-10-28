import type {
  AssistantActionKind,
  AssistantMessageDto,
  AssistantProposal,
  AssistantQuestion,
  AssistantStep,
} from '@telesales/shared';
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CalendarPlus,
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardPen,
  Handshake,
  HelpCircle,
  Loader2,
  MessageSquareShare,
  MonitorPlay,
  type LucideIcon,
} from 'lucide-react';
import { Fragment, type ReactNode, useState } from 'react';
import { Link } from 'react-router';
import { MoraBot } from '@/components/brand/MoraBot';
import { cn } from '@/components/ui/cn';
import { ApiError } from '@/lib/api/ApiError';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { slotProblemText } from '@/features/schedule/slotProblems';
import { useLeave } from './leave';

const SCREEN_NAMES: [RegExp, string][] = [
  [/^\/home/, 'ホーム'],
  [/^\/notifications/, 'お知らせ'],
  [/^\/calls\/companies/, '企業のページ'],
  [/^\/calls\/imports/, '取り込み履歴'],
  [/^\/calls\/import/, 'リスト取り込み'],
  [/^\/calls\/duplicates/, '重複・要確認'],
  [/^\/calls/, '架電状況'],
  [/^\/schedule\/book/, 'アポ登録'],
  [/^\/schedule/, 'スケジュール'],
  [/^\/appointments\/day-before/, '前日確認'],
  [/^\/appointments\/change-requests/, '変更依頼'],
  [/^\/appointments\/next-actions/, '次回アクション'],
  [/^\/appointments\/[^/]+\/mail/, '営業さんへのメール'],
  [/^\/appointments\/./, 'アポのページ'],
  [/^\/appointments/, 'アポ一覧'],
  [/^\/telema/, 'テレマ管理'],
  [/^\/admin/, '管理'],
];

export function screenName(path: string): string {
  return SCREEN_NAMES.find(([pattern]) => pattern.test(path))?.[1] ?? '画面';
}

/** In-app links only: `[画面名](/path)` becomes a button; anything else stays text. */
const LINK = /\[([^\]\n]{1,40})\]\((\/(?!\/)[\w\-/?=&.%]*)\)/g;

export function Reply({ text }: { text: string }) {
  const leave = useLeave();
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const [whole, label = '', to = '/'] = match;
    parts.push(text.slice(last, match.index));
    parts.push(
      <Link
        key={`${match.index}-${to}`}
        to={to}
        onClick={leave}
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
    <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
      {parts.map((part, i) => (
        // Plain text pieces have no identity of their own; markdown bold is shown plainly.
        <Fragment key={i}>{typeof part === 'string' ? part.replace(/\*\*/g, '') : part}</Fragment>
      ))}
    </p>
  );
}

/** MoraBot's work log: each step it took, with a spinner on the one in progress. */
export function StepTrail({
  steps,
  working = false,
}: {
  steps: AssistantStep[];
  working?: boolean;
}) {
  const [open, setOpen] = useState(working);
  if (steps.length === 0 && !working) return null;
  const shown = working || open;
  return (
    <div className="mb-2.5 border-l-2 border-main-line pl-3">
      {!working && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex cursor-pointer items-center gap-1 text-xs font-bold text-ink-sub hover:text-ink"
        >
          <Check aria-hidden="true" className="size-3.5 text-success" />
          {steps.length}件の作業をしました
          <ChevronDown
            aria-hidden="true"
            className={cn('size-3.5 transition-transform', open && 'rotate-180')}
          />
        </button>
      )}
      {shown && (
        <ol className={cn('space-y-1.5', !working && 'mt-1.5')}>
          {steps.map((step, index) => (
            <li
              key={`${index}-${step.text}`}
              className="assistant-step flex items-start gap-2 text-xs text-ink-sub"
            >
              {step.ok ? (
                <Check aria-hidden="true" className="mt-px size-3.5 shrink-0 text-success" />
              ) : (
                <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0 text-warning" />
              )}
              <span>{step.text}</span>
            </li>
          ))}
          {working && (
            <li className="assistant-step flex items-center gap-2 text-xs font-bold text-main">
              <Loader2 aria-hidden="true" className="size-3.5 shrink-0 animate-spin" />
              {steps.length === 0 ? 'ご依頼の内容を読み取っています…' : '続けて作業しています…'}
            </li>
          )}
        </ol>
      )}
    </div>
  );
}

/** A question with choices, answered with one press (or by typing). */
export function QuestionCard({
  question,
  answer,
  disabled,
  onChoose,
  onOther,
}: {
  question: AssistantQuestion;
  /** The person's reply, once given. */
  answer: string | null;
  disabled: boolean;
  onChoose: (label: string) => void;
  onOther: () => void;
}) {
  const answered = answer !== null;
  return (
    <div className="mt-3 border border-main-line bg-surface">
      <p className="flex items-center gap-2 border-b border-line bg-main-soft px-3 py-2 text-sm font-bold">
        <HelpCircle aria-hidden="true" className="size-4 text-main" />
        {question.question}
      </p>
      <div className="flex flex-col gap-1.5 p-2">
        {question.options.map((option, index) => {
          const chosen = answer === option.label;
          return (
            <button
              key={option.label}
              type="button"
              disabled={disabled || answered}
              onClick={() => onChoose(option.label)}
              className={cn(
                'group flex w-full items-start gap-3 border px-3 py-2 text-left transition-colors',
                chosen
                  ? 'border-main bg-main text-white'
                  : 'border-line bg-surface enabled:cursor-pointer enabled:hover:border-main enabled:hover:bg-main-soft disabled:opacity-60',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center text-xs font-bold',
                  chosen
                    ? 'bg-white text-main'
                    : 'bg-main-soft text-main group-enabled:group-hover:bg-main group-enabled:group-hover:text-white',
                )}
              >
                {chosen ? <Check aria-hidden="true" className="size-3.5" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">{option.label}</span>
                {option.description && (
                  <span className={cn('block text-xs', chosen ? 'text-white/85' : 'text-ink-sub')}>
                    {option.description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
        {!answered && (
          <button
            type="button"
            disabled={disabled}
            onClick={onOther}
            className="px-3 py-1.5 text-left text-xs font-bold text-ink-sub enabled:cursor-pointer enabled:hover:text-main"
          >
            ほかの答えを入力する…
          </button>
        )}
        {answered && !question.options.some((option) => option.label === answer) && (
          <p className="px-3 py-1 text-xs text-ink-sub">お答え：{answer}</p>
        )}
      </div>
    </div>
  );
}

const KIND_ICON: Record<AssistantActionKind, LucideIcon> = {
  plan: CalendarPlus,
  booking: CalendarCheck,
  appointment: Handshake,
  callResult: ClipboardPen,
  changeRequest: MessageSquareShare,
};

function failureText(error: unknown): string {
  if (ApiError.isApiError(error)) {
    const details = error.details as { problems?: unknown[]; reason?: string } | undefined;
    if (details?.problems?.length) return details.problems.map(slotProblemText).join(' ');
    if (details?.reason === 'card_expired') {
      return '時間がたったため、このカードは使えません。もう一度MoraBotにお願いしてください。';
    }
    if (details?.reason === 'already_decided') return 'このカードはすでに確定・取りやめ済みです。';
  }
  return errorMessageOf(error);
}

/** One MoraBot proposal: exactly what will be done; nothing happens until 確定. */
export function ActionCard({
  action,
  busy,
  error,
  onConfirm,
  onDismiss,
}: {
  action: AssistantProposal;
  busy: boolean;
  error: unknown;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const leave = useLeave();
  const Icon = KIND_ICON[action.kind];
  const open = action.status === 'PROPOSED';
  return (
    <div
      className={cn(
        'assistant-card mt-3 border bg-surface shadow-(--shadow-raised)',
        open ? 'border-main' : action.status === 'DONE' ? 'border-success/50' : 'border-line',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2.5 px-3 py-2.5',
          open ? 'bg-main text-white' : action.status === 'DONE' ? 'bg-success-soft' : 'bg-column',
        )}
      >
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center',
            open ? 'bg-white/20' : 'bg-surface',
          )}
        >
          <Icon aria-hidden="true" className={cn('size-4.5', !open && 'text-ink-sub')} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{action.title}</p>
          <p className={cn('text-[11px]', open ? 'text-white/85' : 'text-ink-sub')}>
            {open
              ? '内容をご確認ください。「確定」を押すまで何も保存されません。'
              : action.status === 'DONE'
                ? '確定しました'
                : '取りやめました'}
          </p>
        </div>
        {action.status === 'DONE' && (
          <span className="flex items-center gap-1 bg-success px-2 py-0.5 text-[11px] font-bold text-white">
            <Check aria-hidden="true" className="size-3" />
            確定済み
          </span>
        )}
      </div>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 px-3.5 py-3 text-sm">
        {action.lines.map((line) => (
          <div key={line.label} className="contents">
            <dt className="text-xs leading-5 text-ink-sub">{line.label}</dt>
            <dd className="font-medium break-words whitespace-pre-wrap">{line.value}</dd>
          </div>
        ))}
      </dl>
      {open && action.warnings.length > 0 && (
        <ul className="mx-3.5 mb-3 space-y-1 bg-warning-soft px-2.5 py-2 text-xs text-ink">
          {action.warnings.map((warning) => (
            <li key={warning} className="flex gap-1.5">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-warning" />
              {warning}
            </li>
          ))}
        </ul>
      )}
      {open && error !== null && error !== undefined && (
        <p role="alert" className="mx-3.5 mb-3 bg-danger-soft px-2.5 py-2 text-xs text-danger">
          {failureText(error)}
        </p>
      )}
      {open ? (
        <div className="flex gap-2 border-t border-line bg-column px-3.5 py-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 bg-main px-3 py-2 text-sm font-bold text-white hover:bg-main-hover disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Check aria-hidden="true" className="size-4" />
            )}
            {busy ? '実行しています…' : action.confirmLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDismiss}
            className="cursor-pointer border border-line-strong bg-surface px-4 py-2 text-sm font-bold text-ink-sub hover:bg-hover disabled:opacity-60"
          >
            やめる
          </button>
        </div>
      ) : (
        action.status === 'DONE' &&
        action.resultLink && (
          <Link
            to={action.resultLink}
            onClick={leave}
            className="flex items-center justify-end gap-1 border-t border-line px-3.5 py-2 text-xs font-bold text-main hover:bg-main-soft"
          >
            {screenName(action.resultLink)}で見る
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        )
      )}
    </div>
  );
}

/** A screen MoraBot opened, so the person sees where they are now. */
export function OpenedScreen({ path }: { path: string }) {
  const leave = useLeave();
  return (
    <Link
      to={path}
      onClick={leave}
      className="mt-3 flex items-center gap-2 border border-line bg-column px-3 py-2 text-xs font-bold text-ink-sub hover:border-main hover:text-main"
    >
      <MonitorPlay aria-hidden="true" className="size-4 text-main" />
      {`「${screenName(path)}」を開きました`}
      <ArrowRight aria-hidden="true" className="ml-auto size-3.5" />
    </Link>
  );
}

export function UserBubble({ message }: { message: AssistantMessageDto }) {
  return (
    <div className="assistant-in flex justify-end">
      <p className="max-w-[85%] bg-main px-3.5 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-white">
        {message.content}
      </p>
    </div>
  );
}

export function EventLine({ message }: { message: AssistantMessageDto }) {
  const done = message.content.startsWith('【確定】');
  return (
    <p
      className={cn(
        'assistant-in mx-auto flex w-fit items-center gap-1.5 px-3 py-1 text-xs font-bold',
        done ? 'bg-success-soft text-success' : 'bg-column text-ink-sub',
      )}
    >
      {done && <Check aria-hidden="true" className="size-3.5" />}
      {message.content.replace(/^【確定】/, '')}
    </p>
  );
}

/** MoraBot's side of the conversation: avatar, work log, words, and what it prepared. */
export function AssistantRow({
  children,
  mood = 'guide',
  working = false,
}: {
  children: ReactNode;
  mood?: 'guide' | 'think' | 'happy';
  working?: boolean;
}) {
  return (
    <div className="assistant-in flex gap-2.5">
      <div className="shrink-0 pt-0.5">
        <MoraBot
          headOnly={!working}
          mood={mood}
          size={working ? 44 : 30}
          animate={working}
          title=""
        />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
