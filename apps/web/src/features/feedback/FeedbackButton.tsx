import {
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_TYPE_LABEL,
  FEEDBACK_TYPES,
  type FeedbackDto,
  type FeedbackStatus,
  type FeedbackType,
} from '@telesales/shared';
import { Bug, CircleCheck, Lightbulb, MessageSquareText, PenLine, Wrench } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { Textarea } from '@/components/ui/Textarea';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { screenName } from '@/features/assistant/parts';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDateTime } from '@/lib/format';
import { useMyFeedback, useSendFeedback } from './api';

export const FEEDBACK_LABEL = 'ご意見・不具合の報告';

const TYPE_ICON: Record<FeedbackType, typeof Bug> = {
  BUG: Bug,
  REQUEST: Lightbulb,
  FIX: Wrench,
  OTHER: PenLine,
};
const TYPE_HINT: Record<FeedbackType, string> = {
  BUG: '動かない・表示がおかしい',
  REQUEST: 'こうなると便利・新しい機能',
  FIX: '文言・項目・動きを直してほしい',
  OTHER: 'そのほか何でも',
};
export const STATUS_TONE: Record<FeedbackStatus, BadgeTone> = {
  OPEN: 'danger',
  IN_PROGRESS: 'info',
  WAITING_DECISION: 'warning',
  RESOLVED: 'success',
};

/**
 * The 「ご意見・不具合の報告」 button on every screen. On tablets and wider it is a slim tab
 * on the right edge (in the page margin, so it never covers buttons or fields); on phones it
 * is an icon in the top bar. Both stay in view while the page scrolls.
 */
export function FeedbackButton({ variant }: { variant: 'tab' | 'icon' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === 'tab' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="feedback-tab fixed top-1/2 right-0 z-30 hidden -translate-y-1/2 cursor-pointer flex-col items-center gap-1.5 border border-r-0 border-main-line bg-surface px-1.5 py-3 text-xs font-bold tracking-wider text-main shadow-(--shadow-raised) transition-colors hover:bg-main hover:text-white md:flex"
        >
          <MessageSquareText aria-hidden="true" className="size-4" />
          <span className="[writing-mode:vertical-rl]">{FEEDBACK_LABEL}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={FEEDBACK_LABEL}
          title={FEEDBACK_LABEL}
          className="flex size-10 cursor-pointer items-center justify-center text-ink-sub hover:text-ink"
        >
          <MessageSquareText aria-hidden="true" className="size-5" />
        </button>
      )}
      <FeedbackDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation();
  const { name } = useCurrentUser();
  const send = useSendFeedback();
  const mine = useMyFeedback(open);
  const [type, setType] = useState<FeedbackType | null>(null);
  const [body, setBody] = useState('');
  const [tried, setTried] = useState(false);
  const [sent, setSent] = useState<FeedbackDto | null>(null);
  const screenPath = `${location.pathname}${location.search}`;
  const currentScreen = () =>
    document.querySelector('main h1')?.textContent?.trim() || screenName(location.pathname);

  const close = () => {
    onClose();
    // Start fresh next time, but keep a draft that was not sent.
    if (sent) {
      setSent(null);
      setType(null);
      setBody('');
      setTried(false);
    }
    send.reset();
  };
  const submit = () => {
    setTried(true);
    if (!type || !body.trim()) return;
    send.mutate(
      { type, body: body.trim(), screenPath, screenName: currentScreen().slice(0, 100) },
      { onSuccess: setSent },
    );
  };

  return (
    <Dialog
      open={open}
      title={FEEDBACK_LABEL}
      onClose={close}
      footer={
        sent ? (
          <Button onClick={close}>閉じる</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              キャンセル
            </Button>
            <Button onClick={submit} loading={send.isPending}>
              送る
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CircleCheck aria-hidden="true" className="size-12 text-success" />
          <p className="text-base font-bold">送りました（No.{sent.number}）</p>
          <p className="text-sm text-ink-sub">
            担当者にメールで届きました。あなたにも控えのメールが届きます。
            <br />
            対応したら、同じ宛先にメールでお知らせします。
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {send.isError && <Alert tone="error">{errorMessageOf(send.error)}</Alert>}
          <fieldset>
            <legend className="mb-1.5 flex items-baseline gap-1.5 text-[13px] font-bold">
              種類
              <span className="text-[11px] text-danger">必須</span>
            </legend>
            <div role="radiogroup" aria-label="種類" className="grid grid-cols-2 gap-2">
              {FEEDBACK_TYPES.map((value) => {
                const Icon = TYPE_ICON[value];
                const on = type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setType(value)}
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 border p-3 text-left transition-colors',
                      on
                        ? 'border-main bg-main-soft ring-1 ring-main'
                        : 'border-line bg-surface hover:border-main-line',
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn('mt-0.5 size-5 shrink-0', on ? 'text-main' : 'text-ink-sub')}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{FEEDBACK_TYPE_LABEL[value]}</span>
                      <span className="block text-xs text-ink-sub">{TYPE_HINT[value]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {tried && !type && <p className="mt-1.5 text-sm text-danger">種類を選んでください。</p>}
          </fieldset>
          <FormField
            label="内容"
            required
            hint="どの画面で、何をしたら、どうなったか（どうしてほしいか）を書いてください。"
            error={tried && !body.trim() ? '内容を書いてください。' : undefined}
          >
            {(field) => (
              <Textarea
                {...field}
                rows={6}
                maxLength={4000}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            )}
          </FormField>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 bg-column px-3 py-2.5 text-xs text-ink-sub">
            <dt>送る人</dt>
            <dd className="text-ink">{name}</dd>
            <dt>画面</dt>
            <dd className="truncate text-ink">{open ? currentScreen() : ''}</dd>
            <dt>日時</dt>
            <dd className="text-ink">送った時刻が自動で記録されます</dd>
          </dl>
        </div>
      )}
      <MyReports items={mine.data ?? []} />
    </Dialog>
  );
}

function MyReports({ items }: { items: FeedbackDto[] }) {
  if (items.length === 0) return null;
  return (
    <details className="mt-5 border-t border-line pt-3">
      <summary className="cursor-pointer text-sm font-bold text-ink-sub">
        これまでに送った報告（{items.length}件）
      </summary>
      <ul className="mt-2 flex flex-col divide-y divide-line">
        {items.slice(0, 20).map((item) => (
          <li key={item.id} className="flex flex-col gap-1 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-sub">
              <span>No.{item.number}</span>
              <span>{FEEDBACK_TYPE_LABEL[item.type]}</span>
              <span>{formatDateTime(item.createdAt)}</span>
              <Badge tone={STATUS_TONE[item.status]} className="ml-auto">
                {FEEDBACK_STATUS_LABEL[item.status]}
              </Badge>
            </div>
            <p className="line-clamp-2 text-sm whitespace-pre-wrap">{item.body}</p>
            {item.resolution && (
              <p className="border-l-2 border-success pl-2 text-xs whitespace-pre-wrap text-ink-sub">
                {item.resolution}
              </p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
