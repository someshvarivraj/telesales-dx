import {
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPE_LABEL,
  type FeedbackDto,
  type FeedbackStatus,
} from '@telesales/shared';
import { ExternalLink, Paperclip } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { QueryState } from '@/components/ui/QueryState';
import { Segmented } from '@/components/ui/Segmented';
import { Textarea } from '@/components/ui/Textarea';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDateTime } from '@/lib/format';
import { useAdminFeedback, useUpdateFeedback } from './api';
import { FeedbackFiles, STATUS_TONE } from './FeedbackButton';

type Filter = FeedbackStatus | 'ALL';

/** 管理 → ご意見: every report and where it stands; resolving mails what was done. */
export function FeedbackAdminPage() {
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('ALL');
  const query = useAdminFeedback(filter === 'ALL' ? undefined : filter);
  const openId = params.get('id');
  const close = () =>
    setParams(
      (prev) => {
        prev.delete('id');
        return prev;
      },
      { replace: true },
    );

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info">
        各画面の「ご意見・不具合の報告」から届いたものです。メールの宛先は「通知の宛先」の N20
        で変えられます（送った本人にも届きます）。「対応済み」にすると、対応内容が同じ宛先にメールされます。
      </Alert>
      <QueryState query={query}>
        {({ items, counts }) => {
          const total = FEEDBACK_STATUSES.reduce((sum, s) => sum + counts[s], 0);
          const selected = items.find((item) => item.id === openId) ?? null;
          return (
            <>
              <Segmented<Filter>
                aria-label="対応状況で絞り込む"
                value={filter}
                onChange={setFilter}
                className="self-start"
                options={[
                  { value: 'ALL', label: `すべて ${total}` },
                  ...FEEDBACK_STATUSES.map((s) => ({
                    value: s,
                    label: `${FEEDBACK_STATUS_LABEL[s]} ${counts[s]}`,
                  })),
                ]}
              />
              <Card flush>
                {items.length === 0 ? (
                  <EmptyState>該当する報告はありません。</EmptyState>
                ) : (
                  <ul className="divide-y divide-line">
                    {items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setParams((prev) => {
                              prev.set('id', item.id);
                              return prev;
                            })
                          }
                          className="flex w-full cursor-pointer flex-col gap-1.5 px-5 py-3.5 text-left hover:bg-column"
                        >
                          <span className="flex flex-wrap items-center gap-2 text-xs text-ink-sub">
                            <span className="font-bold text-ink">No.{item.number}</span>
                            <Badge tone="outline">{FEEDBACK_TYPE_LABEL[item.type]}</Badge>
                            <span>{item.reporter.name}</span>
                            <span>{formatDateTime(item.createdAt)}</span>
                            <span className="truncate">画面：{item.screenName}</span>
                            <Badge tone={STATUS_TONE[item.status]} className="ml-auto">
                              {FEEDBACK_STATUS_LABEL[item.status]}
                            </Badge>
                          </span>
                          <span className="line-clamp-2 text-sm whitespace-pre-wrap">
                            {item.body}
                          </span>
                          {item.files.length > 0 && (
                            <span className="flex items-center gap-1 text-xs text-ink-sub">
                              <Paperclip aria-hidden="true" className="size-3.5" />
                              添付 {item.files.length}件
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              {selected && <FeedbackDetail key={selected.id} item={selected} onClose={close} />}
            </>
          );
        }}
      </QueryState>
    </div>
  );
}

function FeedbackDetail({ item, onClose }: { item: FeedbackDto; onClose: () => void }) {
  const update = useUpdateFeedback();
  const [status, setStatus] = useState<FeedbackStatus>(item.status);
  const [note, setNote] = useState(item.note ?? '');
  const [resolution, setResolution] = useState(item.resolution ?? '');
  const [tried, setTried] = useState(false);
  const resolving = status === 'RESOLVED';
  const missing = resolving && !resolution.trim();
  const mails = resolving && item.status !== 'RESOLVED';

  const save = () => {
    setTried(true);
    if (missing) return;
    update.mutate(
      { id: item.id, status, note: note.trim() || null, resolution: resolution.trim() || null },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog
      open
      size="lg"
      title={`No.${item.number}　${FEEDBACK_TYPE_LABEL[item.type]}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            閉じる
          </Button>
          <Button onClick={save} loading={update.isPending}>
            {mails ? '対応済みにしてメールする' : '保存'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {update.isError && <Alert tone="error">{errorMessageOf(update.error)}</Alert>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-ink-sub">送った人</dt>
          <dd>{item.reporter.name}</dd>
          <dt className="text-ink-sub">日時</dt>
          <dd>{formatDateTime(item.createdAt)}</dd>
          <dt className="text-ink-sub">画面</dt>
          <dd>
            <Link
              to={item.screenPath}
              className="inline-flex items-center gap-1 text-main underline-offset-2 hover:underline"
            >
              {item.screenName}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </Link>
          </dd>
          {item.handledBy && (
            <>
              <dt className="text-ink-sub">最後に対応した人</dt>
              <dd>
                {item.handledBy.name}（{formatDateTime(item.updatedAt)}）
              </dd>
            </>
          )}
        </dl>
        <p className="border-l-4 border-main-line bg-column px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap">
          {item.body}
        </p>
        <FeedbackFiles feedbackId={item.id} files={item.files} />

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-bold">対応状況</legend>
          <div
            role="radiogroup"
            aria-label="対応状況"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {FEEDBACK_STATUSES.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={status === value}
                onClick={() => setStatus(value)}
                className={cn(
                  'flex h-10 cursor-pointer items-center justify-center border text-sm font-bold transition-colors',
                  status === value
                    ? 'border-main bg-main-soft text-main ring-1 ring-main'
                    : 'border-line text-ink-sub hover:border-main-line',
                )}
              >
                {FEEDBACK_STATUS_LABEL[value]}
              </button>
            ))}
          </div>
          {status === 'WAITING_DECISION' && (
            <p className="mt-1.5 text-xs text-ink-sub">
              判断する人の回答を待っている間はこの状態にします。何を決めてほしいかをメモに書いてください。
            </p>
          )}
        </fieldset>

        <FormField label="メモ（社内向け・メールには載りません）">
          {(field) => (
            <Textarea
              {...field}
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </FormField>
        {(resolving || item.resolution) && (
          <FormField
            label="対応内容"
            required={resolving}
            hint={
              mails
                ? '保存すると、報告を受け取った全員（送った本人を含む）にメールで届きます。'
                : undefined
            }
            error={tried && missing ? '何をしたかを書いてください。' : undefined}
          >
            {(field) => (
              <Textarea
                {...field}
                rows={4}
                maxLength={4000}
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
              />
            )}
          </FormField>
        )}
      </div>
    </Dialog>
  );
}
