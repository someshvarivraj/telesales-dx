import {
  ALL_ROLES,
  type JobRunResponse,
  type NoticeSettingDto,
  RECIPIENT_CONTEXTS,
  RUNNABLE_JOBS,
  type RunnableJob,
  type RecipientField,
  type RecipientKind,
} from '@telesales/shared';
import { Play, X } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { QueryState } from '@/components/ui/QueryState';
import { Select } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';
import { usePeople } from '@/features/reference/useReference';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { timeOptions } from '@/lib/format';
import { ja } from '@/i18n/ja';
import {
  useAddRecipient,
  useNoticeSettings,
  useRemoveRecipient,
  useRunJob,
  useUpdateNotice,
} from './api';

function isRunnable(code: string): code is RunnableJob {
  return (RUNNABLE_JOBS as readonly string[]).includes(code);
}

/** What a run by hand produced, in words. */
function runSummary(result: JobRunResponse): string {
  if (result.reason === 'no_recipients') {
    return '宛先が設定されていないため、送りませんでした。下の「宛先」を足してから実行してください。';
  }
  if (result.emails === 0 && result.notices === 0) {
    return '送るものはありませんでした（対象のアポがない、または今日すでに送り済み）。';
  }
  return `送りました：メール ${result.emails} 通、画面のお知らせ ${result.notices} 件。`;
}

/** Notices that run at a set time (spec §6 定時処理). */
const SCHEDULED = new Set(['N3', 'N4', 'N12', 'N15', 'N19']);
const KIND_LABEL: Record<RecipientKind, string> = {
  EMAIL: 'メールアドレス・ML',
  USER: '人',
  ROLE: '役割の全員',
  CONTEXT: 'その件の関係者',
};
const CONTEXT_LABEL: Record<string, string> = {
  ASSIGNED_REP: '担当営業',
  ASSIGNED_REP_BEFORE: '変更前の担当営業',
  BOOKER: 'アポを取ったテレマ',
  ATTENDEES: '同席者',
  PLAN_OWNER: '予定の持ち主',
  ASSIGNEE: '割り振りの担当',
  RECORD_AUTHOR: '記録を書いた人',
  THREAD: '同じスレッドの人',
};
const TIMES = timeOptions(6, 22).map((time) => ({ value: time, label: time }));

function NoticeCard({ notice }: { notice: NoticeSettingDto }) {
  const update = useUpdateNotice();
  const add = useAddRecipient();
  const remove = useRemoveRecipient();
  const people = usePeople();
  const [draft, setDraft] = useState<{ field: RecipientField; kind: RecipientKind; value: string }>(
    { field: 'TO', kind: 'EMAIL', value: '' },
  );
  const error = update.error ?? add.error ?? remove.error;
  const save = (patch: Partial<NoticeSettingDto>) =>
    update.mutate({
      code: notice.code,
      request: {
        isEnabled: notice.isEnabled,
        sendsEmail: notice.sendsEmail,
        sendTime: notice.sendTime,
        daysBefore: notice.daysBefore,
        ...patch,
      },
    });

  const valueControl =
    draft.kind === 'EMAIL' ? (
      <TextInput
        aria-label="アドレス"
        type="email"
        placeholder="keisu@example.co.jp"
        value={draft.value}
        onChange={(e) => setDraft({ ...draft, value: e.target.value })}
      />
    ) : draft.kind === 'USER' ? (
      <Select
        aria-label="人"
        value={draft.value}
        placeholder="選択"
        options={(people.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
        onChange={(e) => setDraft({ ...draft, value: e.target.value })}
      />
    ) : draft.kind === 'ROLE' ? (
      <Select
        aria-label="役割"
        value={draft.value}
        placeholder="選択"
        options={ALL_ROLES.map((role) => ({ value: role, label: `${ja.role[role]}の全員` }))}
        onChange={(e) => setDraft({ ...draft, value: e.target.value })}
      />
    ) : (
      <Select
        aria-label="関係者"
        value={draft.value}
        placeholder="選択"
        options={RECIPIENT_CONTEXTS.map((value) => ({
          value,
          label: CONTEXT_LABEL[value] ?? value,
        }))}
        onChange={(e) => setDraft({ ...draft, value: e.target.value })}
      />
    );

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Badge tone="outline">{notice.code}</Badge>
          {notice.name}
        </span>
      }
      actions={
        <Checkbox
          label="使う"
          checked={notice.isEnabled}
          onChange={(e) => save({ isEnabled: e.target.checked })}
        />
      }
    >
      <div className="flex flex-col gap-3">
        {error && <Alert tone="error">{errorMessageOf(error)}</Alert>}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Checkbox
            label="メールも送る"
            checked={notice.sendsEmail}
            onChange={(e) => save({ sendsEmail: e.target.checked })}
          />
          {SCHEDULED.has(notice.code) && (
            <label className="flex items-center gap-2 text-sm">
              送る時刻
              <div className="w-28">
                <Select
                  aria-label="送る時刻"
                  value={notice.sendTime ?? ''}
                  placeholder="―"
                  options={TIMES}
                  onChange={(e) => save({ sendTime: e.target.value || null })}
                />
              </div>
            </label>
          )}
          {notice.code === 'N3' && (
            <span className="text-xs text-ink-sub">
              アポの {notice.daysBefore.join('日前・')}日前
            </span>
          )}
          {isRunnable(notice.code) && <RunNowButton code={notice.code} />}
        </div>
        <div>
          <p className="mb-1 text-xs font-bold text-ink-sub">宛先</p>
          <ul className="flex flex-wrap gap-2">
            {notice.recipients.map((recipient) => (
              <li
                key={recipient.id}
                className="flex items-center gap-1 rounded-full border border-line bg-canvas py-0.5 pr-1 pl-2.5 text-xs"
              >
                <span className="font-bold text-ink-sub">{recipient.field}</span>
                {recipient.label}
                <button
                  type="button"
                  aria-label={`${recipient.label}を外す`}
                  onClick={() => remove.mutate({ code: notice.code, id: recipient.id })}
                  className="flex size-5 cursor-pointer items-center justify-center rounded-full hover:bg-column"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </li>
            ))}
            {notice.recipients.length === 0 && (
              <li className="text-xs text-ink-sub">宛先がありません。</li>
            )}
          </ul>
        </div>
        <div className="grid gap-2 sm:grid-cols-[6rem_11rem_1fr_auto]">
          <Select
            aria-label="TO / CC"
            value={draft.field}
            options={[
              { value: 'TO', label: 'TO' },
              { value: 'CC', label: 'CC' },
            ]}
            onChange={(e) => setDraft({ ...draft, field: e.target.value as RecipientField })}
          />
          <Select
            aria-label="種類"
            value={draft.kind}
            options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))}
            onChange={(e) =>
              setDraft({ ...draft, kind: e.target.value as RecipientKind, value: '' })
            }
          />
          {valueControl}
          <Button
            variant="secondary"
            loading={add.isPending}
            disabled={!draft.value.trim()}
            onClick={() =>
              add.mutate(
                { code: notice.code, request: { ...draft, value: draft.value.trim() } },
                { onSuccess: () => setDraft({ ...draft, value: '' }) },
              )
            }
          >
            宛先を追加
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Recipients, days and times per notice (spec §8: never written in the program). */
/**
 * Runs the timed notice now instead of waiting for its time (for the test environment):
 * the same rules apply, so anything already sent today is not sent again.
 */
function RunNowButton({ code }: { code: RunnableJob }) {
  const run = useRunJob();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        icon={<Play className="size-4" aria-hidden="true" />}
        loading={run.isPending}
        onClick={() => run.mutate(code)}
      >
        今すぐ実行
      </Button>
      {run.data && <span className="text-xs text-ink-sub">{runSummary(run.data)}</span>}
      {run.isError && <span className="text-xs text-danger">{errorMessageOf(run.error)}</span>}
    </div>
  );
}

export function NoticesPage() {
  const query = useNoticeSettings();
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info">
        宛先（メールアドレス・メーリングリスト）が変わったときは、ここで変えてください。「その件の関係者」は、通知ごとに自動で決まります（例：担当営業）。
      </Alert>
      <QueryState query={query}>
        {(items) => (
          <div className="flex flex-col gap-4">
            {items.map((notice) => (
              <NoticeCard key={notice.code} notice={notice} />
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
