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
import {
  AtSign,
  BellRing,
  Clock,
  Link2,
  Mail,
  MonitorSmartphone,
  Play,
  Plus,
  Search,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { QueryState } from '@/components/ui/QueryState';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { TextInput } from '@/components/ui/TextInput';
import { TimePicker } from '@/components/ui/TimePicker';
import {
  NOTICE_CATEGORIES,
  noticeKindOf,
  TONE_BAR,
  TONE_CLASS,
} from '@/features/notifications/noticeKinds';
import { usePeople } from '@/features/reference/useReference';
import { errorMessageOf } from '@/lib/api/errorMessage';
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
  CONTEXT: 'その件の関係者',
  USER: '人',
  ROLE: '役割の全員',
  EMAIL: 'メールアドレス・ML',
};
const KIND_ICON: Record<RecipientKind, typeof Link2> = {
  CONTEXT: Link2,
  USER: UserRound,
  ROLE: Users,
  EMAIL: AtSign,
};

/** When each notice goes out, in one line (spec §8). */
const WHEN: Record<string, string> = {
  N1: 'アポを登録したとき',
  N2: 'Webのアポを登録したとき（会議リンクの発行をお願いする）',
  N3: 'アポの数日前の決まった時刻に、会議URLがまだ登録されていないとき',
  N4: '毎日決まった時刻に、翌日のアポをまとめて',
  N6: 'アポの日時・担当が変わったとき',
  N7: '営業が変更依頼を出したとき',
  N8: 'アポを取り消したとき',
  N9: '予定の同席者に入れたとき',
  N10: '予定を変えたとき',
  N11: '割り振りを確定したとき',
  N12: '毎日決まった時刻に、前日確認が必要なアポがあるとき',
  N13: '変更依頼が決まった時間内に対応されないとき',
  N14: '前日確認の結果を営業へ送るとき',
  N15: '決まった時刻に、仮予定が残っているとき',
  N16: '打ち合わせ結果を入力したとき',
  N17: '架電リストを取り込んだとき',
  N18: 'コメントが付いたとき',
  N19: '毎日決まった時刻に、その日のアポ取得一覧',
};

type Filter = 'all' | 'on' | 'off' | 'mail';
const CONTEXT_LABEL: Record<string, string> = {
  ASSIGNED_REP: '担当営業',
  ASSIGNED_REP_BEFORE: '変更前の担当営業',
  BOOKER: 'アポを取ったテレマ',
  ATTENDEES: '同席者',
  PLAN_OWNER: '予定の持ち主',
  ASSIGNEE: '割り振りの担当',
  RECORD_AUTHOR: '記録を書いた人',
  THREAD: '同じスレッドの人',
  REPORTER: '報告した人',
};

function categoryOf(code: string) {
  return NOTICE_CATEGORIES.find((category) => category.codes.includes(code));
}

/** 画面＋メール / 画面のみ / 停止 */
function deliveryText(notice: NoticeSettingDto): string {
  if (!notice.isEnabled) return '停止中';
  return notice.sendsEmail ? '画面＋メール' : '画面のみ';
}

function NoticeDetail({ notice }: { notice: NoticeSettingDto }) {
  const update = useUpdateNotice();
  const remove = useRemoveRecipient();
  const kind = noticeKindOf(notice.code);
  const error = update.error ?? remove.error;
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

  return (
    <article className="fade-in flex flex-col">
      <div className={cn('h-1', notice.isEnabled ? TONE_BAR[kind.tone] : 'bg-line-strong')} />
      <header className="flex items-start gap-4 border-b border-line px-6 py-5">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-12 shrink-0 items-center justify-center',
            notice.isEnabled ? TONE_CLASS[kind.tone] : 'bg-column text-ink-disabled',
          )}
        >
          <kind.icon className="size-6" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-ink-sub">
            {notice.code} · {categoryOf(notice.code)?.label ?? 'お知らせ'}
          </p>
          <h2 className="mt-0.5 text-xl font-bold">{notice.name}</h2>
          {WHEN[notice.code] && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-sub">
              <BellRing aria-hidden="true" className="size-4 shrink-0" />
              送るとき：{WHEN[notice.code]}
            </p>
          )}
        </div>
        <Switch
          label={notice.isEnabled ? '使う' : '使わない'}
          checked={notice.isEnabled}
          onChange={(value) => save({ isEnabled: value })}
        />
      </header>

      <div className={cn('flex flex-col gap-6 px-6 py-5', !notice.isEnabled && 'opacity-55')}>
        {error && <Alert tone="error">{errorMessageOf(error)}</Alert>}

        {/* How it arrives */}
        <section>
          <h3 className="mb-2 text-xs font-bold text-ink-sub">届き方</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-3 border border-line bg-column/60 p-3">
              <MonitorSmartphone aria-hidden="true" className="size-5 text-schedule" />
              <div className="flex-1">
                <p className="text-sm font-bold">画面のお知らせ</p>
                <p className="text-xs text-ink-sub">ベルとお知らせ画面に出ます（いつも）</p>
              </div>
            </div>
            <div
              className={cn(
                'flex items-center gap-3 border p-3 transition-colors',
                notice.sendsEmail ? 'border-main-line bg-main-soft' : 'border-line',
              )}
            >
              <Mail
                aria-hidden="true"
                className={cn('size-5', notice.sendsEmail ? 'text-main' : 'text-ink-sub')}
              />
              <div className="flex-1">
                <p className="text-sm font-bold">メール</p>
                <p className="text-xs text-ink-sub">下の宛先にメールも送ります</p>
              </div>
              <Switch
                label={<span className="sr-only">メールも送る</span>}
                checked={notice.sendsEmail}
                disabled={!notice.isEnabled}
                onChange={(value) => save({ sendsEmail: value })}
              />
            </div>
          </div>
        </section>

        {(SCHEDULED.has(notice.code) || isRunnable(notice.code)) && (
          <section>
            <h3 className="mb-2 text-xs font-bold text-ink-sub">送る時刻</h3>
            <div className="flex flex-wrap items-center gap-3">
              {SCHEDULED.has(notice.code) && (
                <TimePicker
                  aria-label="送る時刻"
                  className="w-32"
                  fromHour={6}
                  toHour={22}
                  value={notice.sendTime ?? ''}
                  onChange={(e) => save({ sendTime: e.target.value || null })}
                />
              )}
              {notice.code === 'N3' && (
                <span className="text-sm text-ink-sub">
                  アポの {notice.daysBefore.join('日前・')}日前
                </span>
              )}
              {isRunnable(notice.code) && <RunNowButton code={notice.code} />}
            </div>
          </section>
        )}

        <section>
          <div className="mb-2 flex items-baseline gap-2">
            <h3 className="text-xs font-bold text-ink-sub">宛先</h3>
            <p className="text-xs text-ink-sub">
              「その件の関係者」はアポごとに自動で決まります（例：担当営業）。
            </p>
          </div>
          <div className="grid items-start gap-3 lg:grid-cols-2">
            {(['TO', 'CC'] as RecipientField[]).map((field) => (
              <RecipientBox
                key={field}
                notice={notice}
                field={field}
                onRemove={(id) => remove.mutate({ code: notice.code, id })}
              />
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}

function RecipientBox({
  notice,
  field,
  onRemove,
}: {
  notice: NoticeSettingDto;
  field: RecipientField;
  onRemove: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const list = notice.recipients.filter((recipient) => recipient.field === field);
  return (
    <div className="flex flex-col border border-line">
      <div className="flex items-center gap-2 border-b border-line bg-column px-3 py-2">
        <span className="bg-ink px-1.5 text-[11px] leading-5 font-bold text-white">{field}</span>
        <span className="text-xs text-ink-sub">
          {field === 'TO' ? '主な宛先' : '写し（参考に送る人）'}
        </span>
        <span className="ml-auto text-xs text-ink-sub tabular-nums">{list.length}件</span>
      </div>
      <ul className="flex min-h-14 flex-col">
        {list.length === 0 && (
          <li className="px-3 py-3 text-xs text-ink-disabled">まだありません</li>
        )}
        {list.map((recipient) => {
          const Icon = KIND_ICON[recipient.kind];
          return (
            <li
              key={recipient.id}
              className="group flex items-center gap-2.5 border-b border-line/70 px-3 py-2 last:border-b-0"
            >
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center bg-column text-ink-sub"
              >
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{recipient.label}</span>
                <span className="block text-[11px] text-ink-sub">{KIND_LABEL[recipient.kind]}</span>
              </span>
              <button
                type="button"
                aria-label={`${recipient.label}を外す`}
                onClick={() => onRemove(recipient.id)}
                className="flex size-7 cursor-pointer items-center justify-center text-ink-sub opacity-0 group-hover:opacity-100 hover:bg-danger-soft hover:text-danger focus:opacity-100"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      {adding ? (
        <AddRecipient notice={notice} field={field} onDone={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-9 cursor-pointer items-center justify-center gap-1.5 border-t border-dashed border-line text-xs font-bold text-link hover:bg-hover"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          {field}に追加
        </button>
      )}
    </div>
  );
}

function AddRecipient({
  notice,
  field,
  onDone,
}: {
  notice: NoticeSettingDto;
  field: RecipientField;
  onDone: () => void;
}) {
  const add = useAddRecipient();
  const people = usePeople();
  const [kind, setKind] = useState<RecipientKind>('CONTEXT');
  const [value, setValue] = useState('');
  const control: ReactNode =
    kind === 'EMAIL' ? (
      <TextInput
        autoFocus
        aria-label="アドレス"
        type="email"
        placeholder="keisu@example.co.jp"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    ) : (
      <Select
        aria-label={KIND_LABEL[kind]}
        value={value}
        placeholder="選んでください"
        options={
          kind === 'USER'
            ? (people.data ?? []).map((p) => ({ value: p.id, label: p.name }))
            : kind === 'ROLE'
              ? ALL_ROLES.map((role) => ({ value: role, label: `${ja.role[role]}の全員` }))
              : RECIPIENT_CONTEXTS.map((v) => ({ value: v, label: CONTEXT_LABEL[v] ?? v }))
        }
        onChange={(e) => setValue(e.target.value)}
      />
    );
  return (
    <form
      className="pop-in flex flex-col gap-2.5 border-t border-line bg-canvas p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!value.trim()) return;
        add.mutate(
          { code: notice.code, request: { field, kind, value: value.trim() } },
          { onSuccess: onDone },
        );
      }}
    >
      <Segmented
        aria-label="宛先の種類"
        size="sm"
        className="flex-wrap"
        value={kind}
        onChange={(next) => {
          setKind(next);
          setValue('');
        }}
        options={(Object.keys(KIND_LABEL) as RecipientKind[]).map((k) => ({
          value: k,
          label:
            k === 'EMAIL' ? 'メール' : k === 'CONTEXT' ? '関係者' : k === 'ROLE' ? '役割' : '人',
        }))}
      />
      {control}
      {add.isError && <p className="text-xs text-danger">{errorMessageOf(add.error)}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="text" onClick={onDone}>
          やめる
        </Button>
        <Button type="submit" loading={add.isPending} disabled={!value.trim()}>
          {field}に追加
        </Button>
      </div>
    </form>
  );
}

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

/** Recipients, days and times per notice (spec §8: never written in the program). */
export function NoticesPage() {
  const query = useNoticeSettings();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  return (
    <QueryState query={query}>
      {(items) => {
        const needle = search.trim().toLowerCase();
        const shown = items.filter(
          (notice) =>
            (filter === 'all' ||
              (filter === 'on' && notice.isEnabled) ||
              (filter === 'off' && !notice.isEnabled) ||
              (filter === 'mail' && notice.isEnabled && notice.sendsEmail)) &&
            (!needle ||
              [
                notice.code,
                notice.name,
                WHEN[notice.code],
                ...notice.recipients.map((r) => r.label),
              ]
                .filter(Boolean)
                .some((text) => String(text).toLowerCase().includes(needle))),
        );
        const current = items.find((notice) => notice.code === selected) ?? shown[0] ?? items[0];
        const groups = [
          ...NOTICE_CATEGORIES.map((category) => ({
            key: category.key,
            label: category.label,
            items: shown.filter((notice) => category.codes.includes(notice.code)),
          })),
          {
            key: 'other',
            label: 'その他',
            items: shown.filter((notice) => !categoryOf(notice.code)),
          },
        ].filter((group) => group.items.length > 0);
        return (
          <div className="grid border border-line bg-surface shadow-(--shadow-card) lg:grid-cols-[22rem_1fr]">
            <section
              className="flex min-h-0 flex-col border-line lg:border-r"
              aria-label="通知の一覧"
            >
              <div className="flex flex-col gap-2 border-b border-line p-3">
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-sub"
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="通知名・宛先で探す"
                    aria-label="通知名・宛先で探す"
                    className="h-9 w-full border border-line-strong bg-canvas pr-2 pl-8 text-sm placeholder:text-ink-disabled focus:border-main-focus focus:bg-surface focus:outline-none"
                  />
                </div>
                <Segmented
                  aria-label="絞り込み"
                  size="sm"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'all', label: `すべて ${items.length}` },
                    { value: 'on', label: '使用中' },
                    { value: 'mail', label: 'メールあり' },
                    { value: 'off', label: '停止中' },
                  ]}
                />
              </div>
              <div className="scroll-quiet max-h-[calc(100dvh-16rem)] overflow-y-auto">
                {groups.map((group) => (
                  <div key={group.key}>
                    <p className="sticky top-0 z-10 border-b border-line bg-column/95 px-3 py-1.5 text-[11px] font-bold text-ink-sub">
                      {group.label}
                    </p>
                    <ul>
                      {group.items.map((notice) => {
                        const kind = noticeKindOf(notice.code);
                        const on = current?.code === notice.code;
                        const missing =
                          notice.isEnabled && notice.sendsEmail && notice.recipients.length === 0;
                        return (
                          <li key={notice.code} className="relative">
                            {on && (
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'absolute inset-y-0 left-0 w-[3px]',
                                  TONE_BAR[kind.tone],
                                )}
                              />
                            )}
                            <button
                              type="button"
                              aria-current={on || undefined}
                              onClick={() => setSelected(notice.code)}
                              className={cn(
                                'flex w-full cursor-pointer items-center gap-3 border-b border-line/70 px-3 py-2.5 text-left transition-colors',
                                on ? 'bg-main-soft' : 'hover:bg-hover',
                              )}
                            >
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'flex size-8 shrink-0 items-center justify-center',
                                  notice.isEnabled
                                    ? TONE_CLASS[kind.tone]
                                    : 'bg-column text-ink-disabled',
                                )}
                              >
                                <kind.icon className="size-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span
                                  className={cn(
                                    'block truncate text-sm font-bold',
                                    !notice.isEnabled && 'text-ink-sub',
                                  )}
                                >
                                  <span className="mr-1.5 font-normal text-ink-sub tabular-nums">
                                    {notice.code}
                                  </span>
                                  {notice.name}
                                </span>
                                <span className="flex items-center gap-1.5 text-[11px] text-ink-sub">
                                  <span
                                    className={cn(
                                      'font-bold',
                                      !notice.isEnabled
                                        ? 'text-ink-disabled'
                                        : notice.sendsEmail
                                          ? 'text-main'
                                          : 'text-schedule',
                                    )}
                                  >
                                    {deliveryText(notice)}
                                  </span>
                                  · 宛先 {notice.recipients.length}
                                  {notice.sendTime && (
                                    <span className="flex items-center gap-0.5">
                                      · <Clock aria-hidden="true" className="size-3" />
                                      {notice.sendTime}
                                    </span>
                                  )}
                                  {missing && (
                                    <span className="font-bold text-danger">· 宛先なし</span>
                                  )}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
                {shown.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-ink-sub">見つかりません</p>
                )}
              </div>
            </section>
            <section aria-label="通知の設定" className="min-w-0">
              {current && <NoticeDetail key={current.code} notice={current} />}
            </section>
          </div>
        );
      }}
    </QueryState>
  );
}
