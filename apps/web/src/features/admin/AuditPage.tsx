import type { AuditChangeDto, AuditLogDto } from '@telesales/shared';
import { jstDate, jstTime } from '@telesales/shared';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CalendarX,
  Cog,
  type LucideIcon,
  LogIn,
  Mail,
  PhoneCall,
  Search,
  ShieldAlert,
  UserCog,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { cn } from '@/components/ui/cn';
import { DatePicker } from '@/components/ui/DatePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { relativeDay } from '@/components/ui/DatePicker';
import { formatDate, todayJst } from '@/lib/format';
import { Avatar } from '@/features/schedule/calendar/Avatar';
import { personColor } from '@/features/schedule/calendar/people';
import { useAdminUsers, useAuditLog } from './api';

/** What the entry was about. Empty filter = everything. */
const TARGETS: Record<string, string> = {
  appointment: 'アポ',
  meeting_result: '打ち合わせ結果',
  change_request: '変更依頼',
  plan: '予定',
  time_off: '休み',
  slot_lock: '押さえ',
  company: '企業',
  call_record: '架電記録',
  list_import: 'リスト取り込み',
  user: 'ユーザー',
  email: 'メール',
  notice_setting: '通知の設定',
  notice_recipient: '通知の宛先',
  sales_area_rule: '営業担当表',
  company_group: '企業グループ',
  option: '選択肢',
  calendar_day: '休日カレンダー',
  calendar_year: '祝日の取り込み',
  app_setting: 'その他の設定',
  app: 'アプリ',
  shift: 'シフト',
  telemarketer_profile: 'テレマ情報',
  allocation: '割り振り',
  scheduled_job: '定時処理',
};

/** Recorded actions in plain words. */
const ACTIONS: Record<string, string> = {
  'auth.login.succeeded': 'ログイン',
  'auth.login.failed': 'ログイン失敗',
  'auth.account.locked': 'アカウントのロック',
  'auth.logout': 'ログアウト',
  'auth.password.changed': 'パスワード変更',
  'user.created': 'ユーザー登録',
  'user.updated': 'ユーザー変更',
  'user.roles.changed': '役割の変更',
  'user.password.reset': 'パスワード再発行',
  'company.created': '企業の登録',
  'company.updated': '企業の変更',
  'company.flag.resolved': '重複・要確認の扱いを決定',
  'company.merged': '企業の統合',
  'list.imported': 'リスト取り込み',
  'call_record.created': '架電結果の入力',
  'call_record.updated': '架電結果の変更',
  'appointment.created': 'アポ登録',
  'appointment.updated': 'アポの変更',
  'appointment.rescheduled': '日時の変更',
  'appointment.cancelled': 'アポの取り消し',
  'appointment.confirmed': '営業の確認',
  'appointment.day_before.checked': '前日確認',
  'appointment.result.added': '打ち合わせ結果',
  'appointment.preparation.added': '準備の記録',
  'appointment.next_action.updated': '次回アクション',
  'change_request.updated': '変更依頼の対応',
  'email.sent': 'メール送信',
  'plan.created': '予定の登録',
  'plan.updated': '予定の変更',
  'plan.deleted': '予定の削除',
  'time_off.created': '休みの登録',
  'time_off.deleted': '休みの削除',
  'slot_lock.released': '押さえの解除',
  'settings.changed': '設定の変更',
  'telemarketer.updated': 'テレマ情報の変更',
  'shift.saved': 'シフトの入力',
  'shift.deleted': 'シフトの削除',
  'shift.filled': 'シフトの一括入力',
  'allocation.calculated': '割り振りの計算',
  'allocation.moved': '割り振りの手直し',
  'allocation.confirmed': '割り振りの確定',
  'app.created': 'アプリの追加',
  'app.updated': 'アプリの変更',
  'feedback.updated': 'ご意見の対応',
};

/** Field names in plain words; anything else is shown as recorded. */
const FIELDS: Record<string, string> = {
  name: '名前',
  email: 'メールアドレス',
  employeeNo: '社員番号',
  roles: '役割',
  status: '状態',
  startsAt: '開始',
  endsAt: '終了',
  salesRepId: '担当営業',
  backupRepId: '代わりの人',
  bookedById: 'アポ取得者',
  format: '訪問形態',
  reason: '理由',
  title: '件名',
  note: 'メモ',
  memo: 'メモ',
  phone: '電話番号',
  address: '住所',
  url: 'URL',
  prefecture: '都道府県',
  city: '市区町村',
  customerType: '取引区分',
  grade: '判定',
  result: '結果',
  nextCallDate: '次回架電日',
  meetingUrl: '会議URL',
  webOnly: 'Webのみ',
  validFrom: 'いつから',
  validTo: 'いつまで',
  isActive: '使用中',
  members: '対象の企業',
  flag: '印',
  purpose: '目的',
  rowCount: '件数',
  to: '宛先',
  subject: '件名',
  date: '日付',
  kind: '種類',
  attendees: '同席者',
  salesRep: '担当営業',
  bookedBy: 'アポ取得者',
  owner: '誰の予定',
  company: '企業',
  contactName: '先方担当者',
  contactPhone: '先方TEL',
  handoverNotes: '伝達事項',
  visitAddress: '訪問先',
};

/** Recorded codes shown in plain words. */
const VALUES: Record<string, string> = {
  SCHEDULED: '予定',
  CANCELLED: '取り消し',
  DONE: '完了',
  COMPLETED: '完了',
  VISIT: '訪問',
  ONLINE: 'Web',
  FIXED: '確定',
  TENTATIVE: '仮予定',
  ACTIVE: '有効',
  DISABLED: '停止',
  OPEN: '未対応',
  IN_PROGRESS: '対応中',
  RESOLVED: '対応済み',
  true: 'はい',
  false: 'いいえ',
};

/** Shows a recorded value readably: {"id","name"} → name, codes → words. */
function readable(value: string | null): string | null {
  if (value === null) return null;
  const text = value.trim();
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(text);
      const name = (entry: unknown) =>
        entry && typeof entry === 'object' && 'name' in entry
          ? String(entry.name)
          : JSON.stringify(entry);
      return Array.isArray(parsed) ? parsed.map(name).join('、') || '（なし）' : name(parsed);
    } catch {
      return value;
    }
  }
  return VALUES[text] ?? value;
}

/** What kind of operation: one colour and icon each, as in an activity timeline. */
interface Category {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Icon tile and summary tile colours. */
  tone: string;
  bar: string;
  match: (action: string) => boolean;
}

const CATEGORIES: Category[] = [
  {
    key: 'alert',
    label: 'ログイン失敗・ロック',
    icon: ShieldAlert,
    tone: 'bg-danger-soft text-danger',
    bar: 'bg-danger',
    match: (a) => a === 'auth.login.failed' || a === 'auth.account.locked',
  },
  {
    key: 'auth',
    label: 'ログイン・パスワード',
    icon: LogIn,
    tone: 'bg-admin-soft text-admin',
    bar: 'bg-admin',
    match: (a) => a.startsWith('auth.'),
  },
  {
    key: 'cancel',
    label: 'アポの取り消し',
    icon: CalendarX,
    tone: 'bg-danger-soft text-danger',
    bar: 'bg-danger',
    match: (a) => a === 'appointment.cancelled',
  },
  {
    key: 'appointment',
    label: 'アポ',
    icon: Building2,
    tone: 'bg-appointments-soft text-appointments',
    bar: 'bg-appointments',
    match: (a) => a.startsWith('appointment.') || a.startsWith('change_request.'),
  },
  {
    key: 'schedule',
    label: '予定・休み',
    icon: CalendarClock,
    tone: 'bg-schedule-soft text-schedule',
    bar: 'bg-schedule',
    match: (a) => /^(plan|time_off|slot_lock)\./.test(a),
  },
  {
    key: 'calls',
    label: '架電・テレマ',
    icon: PhoneCall,
    tone: 'bg-calls-soft text-calls',
    bar: 'bg-calls',
    match: (a) => /^(company|list|call_record|shift|allocation|telemarketer)\./.test(a),
  },
  {
    key: 'email',
    label: 'メール',
    icon: Mail,
    tone: 'bg-success-soft text-success',
    bar: 'bg-success',
    match: (a) => a.startsWith('email.'),
  },
  {
    key: 'users',
    label: 'ユーザー',
    icon: Users,
    tone: 'bg-role-admin-soft text-role-admin',
    bar: 'bg-role-admin',
    match: (a) => a.startsWith('user.'),
  },
  {
    key: 'settings',
    label: '設定',
    icon: Cog,
    tone: 'bg-admin-soft text-admin',
    bar: 'bg-admin',
    match: () => true,
  },
];

function categoryOf(action: string): Category {
  return CATEGORIES.find((category) => category.match(action)) ?? (CATEGORIES.at(-1) as Category);
}

function targetLink(item: AuditLogDto): string | null {
  if (!item.targetId) return null;
  if (item.targetType === 'appointment') return paths.appointment(item.targetId);
  if (item.targetType === 'company') return paths.company(item.targetId);
  return null;
}

function daysAgo(days: number): string {
  const date = new Date(`${todayJst()}T00:00:00+09:00`);
  date.setDate(date.getDate() - days);
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
}

type Period = '1' | '7' | '30' | 'custom';

/**
 * 操作履歴 (Q-09, 10/20) as a timeline: day by day, each operation with its colour and
 * icon, who did it, and the fields that changed before → after. Older history is
 * extracted on request by an engineer.
 */
export function AuditPage() {
  const [filter, setFilter] = useState({
    targetType: '',
    actorId: '',
    from: daysAgo(6),
    to: todayJst(),
  });
  const [period, setPeriod] = useState<Period>('7');
  const [category, setCategory] = useState<string | null>(null);
  const [text, setText] = useState('');
  const users = useAdminUsers();
  const order = (users.data ?? []).map((user) => user.id);
  const query = useAuditLog({
    targetType: filter.targetType || undefined,
    actorId: filter.actorId || undefined,
    from: filter.from || undefined,
    to: filter.to || undefined,
  });

  const choosePeriod = (value: Period) => {
    setPeriod(value);
    if (value !== 'custom')
      setFilter({ ...filter, from: daysAgo(Number(value) - 1), to: todayJst() });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filters in one toolbar */}
      <div className="flex flex-wrap items-center gap-2 border border-line bg-surface p-3 shadow-(--shadow-card)">
        <Segmented
          aria-label="期間"
          value={period}
          onChange={choosePeriod}
          options={[
            { value: '1', label: '今日' },
            { value: '7', label: '7日' },
            { value: '30', label: '30日' },
            { value: 'custom', label: '期間を指定' },
          ]}
        />
        {period === 'custom' && (
          <div className="flex items-center gap-1.5">
            <DatePicker
              aria-label="期間（から）"
              size="sm"
              className="w-44"
              value={filter.from}
              onChange={(e) => setFilter({ ...filter, from: e.target.value })}
            />
            <span className="text-ink-sub">〜</span>
            <DatePicker
              aria-label="期間（まで）"
              size="sm"
              className="w-44"
              value={filter.to}
              min={filter.from}
              onChange={(e) => setFilter({ ...filter, to: e.target.value })}
            />
          </div>
        )}
        <Select
          aria-label="対象"
          size="sm"
          className="w-40"
          value={filter.targetType}
          placeholder="対象：すべて"
          options={Object.entries(TARGETS).map(([value, label]) => ({ value, label }))}
          onChange={(e) => setFilter({ ...filter, targetType: e.target.value })}
        />
        <Select
          aria-label="誰"
          size="sm"
          className="w-40"
          value={filter.actorId}
          placeholder="誰：全員"
          options={(users.data ?? []).map((user) => ({
            value: user.id,
            label: user.name,
            icon: <Avatar size="sm" name={user.name} color={personColor(user.id, order)} />,
          }))}
          onChange={(e) => setFilter({ ...filter, actorId: e.target.value })}
        />
        <div className="relative ml-auto min-w-48 flex-1 sm:max-w-64">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-sub"
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="操作・項目・値で絞り込む"
            aria-label="操作・項目・値で絞り込む"
            className="h-9 w-full border border-line-strong bg-surface pr-2 pl-8 text-sm placeholder:text-ink-disabled focus:border-main-focus focus:ring-3 focus:ring-main-focus/20 focus:outline-none"
          />
        </div>
      </div>

      <QueryState query={query}>
        {(data) => {
          const needle = text.trim().toLowerCase();
          const counted = data.items.map((item) => ({ item, category: categoryOf(item.action) }));
          const shown = counted.filter(
            ({ item, category: c }) =>
              (!category || c.key === category) &&
              (!needle ||
                [
                  item.actor?.name,
                  ACTIONS[item.action],
                  item.action,
                  ...item.changes.flatMap((ch) => [
                    FIELDS[ch.field],
                    readable(ch.before),
                    readable(ch.after),
                  ]),
                ]
                  .filter(Boolean)
                  .some((value) => String(value).toLowerCase().includes(needle))),
          );
          const days = [...new Set(shown.map(({ item }) => jstDate(new Date(item.createdAt))))];
          const totals = CATEGORIES.map((c) => ({
            category: c,
            count: counted.filter((entry) => entry.category.key === c.key).length,
          })).filter((entry) => entry.count > 0);
          return (
            <>
              {/* Summary: how much of what, click to narrow */}
              {totals.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-2">
                  {totals.map(({ category: c, count }) => {
                    const on = category === c.key;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setCategory(on ? null : c.key)}
                        className={cn(
                          'relative flex cursor-pointer items-center gap-2.5 overflow-hidden border bg-surface p-2.5 text-left transition-[border-color,box-shadow]',
                          on
                            ? 'border-ink shadow-[0_0_0_1px_var(--color-ink)]'
                            : 'border-line hover:border-line-strong',
                        )}
                      >
                        <span className={cn('absolute inset-y-0 left-0 w-[3px]', c.bar)} />
                        <span
                          className={cn('flex size-8 shrink-0 items-center justify-center', c.tone)}
                        >
                          <c.icon aria-hidden="true" className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-lg leading-6 font-bold tabular-nums">
                            {count}
                          </span>
                          <span className="block truncate text-[11px] text-ink-sub">{c.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-ink-sub">
                画面で見られるのは直近{data.days}
                日分です。それより前の履歴は、管理者からシステム担当に依頼して出します。
              </p>
              {data.truncated && (
                <Alert tone="info">
                  件数が多いため、新しい順に一部だけ表示しています。期間や対象を絞ってください。
                </Alert>
              )}
              {shown.length === 0 ? (
                <div className="border border-line bg-surface">
                  <EmptyState>この条件の履歴はありません。</EmptyState>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {days.map((day) => {
                    const entries = shown.filter(
                      ({ item }) => jstDate(new Date(item.createdAt)) === day,
                    );
                    const hint = relativeDay(day);
                    return (
                      <section
                        key={day}
                        className="border border-line bg-surface shadow-(--shadow-card)"
                      >
                        <h3 className="sticky top-0 z-10 flex items-baseline gap-2 border-b border-line bg-surface/95 px-5 py-2.5 backdrop-blur-sm">
                          <span className="text-sm font-bold">{formatDate(day)}</span>
                          {hint && <span className="text-xs text-ink-sub">{hint}</span>}
                          <span className="ml-auto text-xs text-ink-sub">{entries.length}件</span>
                        </h3>
                        <ol className="relative py-2">
                          <span
                            aria-hidden="true"
                            className="absolute top-0 bottom-0 left-[6.6rem] w-px bg-line max-sm:left-[4.6rem]"
                          />
                          {entries.map(({ item, category: c }) => (
                            <AuditRow key={item.id} item={item} category={c} order={order} />
                          ))}
                        </ol>
                      </section>
                    );
                  })}
                </div>
              )}
            </>
          );
        }}
      </QueryState>
    </div>
  );
}

function AuditRow({
  item,
  category,
  order,
}: {
  item: AuditLogDto;
  category: Category;
  order: string[];
}) {
  const link = targetLink(item);
  const target = item.targetType ? (TARGETS[item.targetType] ?? item.targetType) : null;
  const alert = category.key === 'alert';
  return (
    <li
      className={cn(
        'relative grid grid-cols-[5.5rem_2.25rem_1fr] gap-x-3 px-5 py-2.5 max-sm:grid-cols-[3.5rem_2.25rem_1fr] max-sm:px-3',
        alert && 'bg-danger-soft/40',
      )}
    >
      <time
        className="pt-1.5 text-right text-xs text-ink-sub tabular-nums"
        dateTime={item.createdAt}
      >
        {jstTime(new Date(item.createdAt))}
      </time>
      <span
        className={cn(
          'relative z-[1] flex size-9 items-center justify-center ring-4 ring-surface',
          category.tone,
        )}
      >
        <category.icon aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
          {item.actor ? (
            <span className="flex items-center gap-1.5 text-sm font-bold">
              <Avatar size="sm" name={item.actor.name} color={personColor(item.actor.id, order)} />
              {item.actor.name}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm font-bold text-ink-sub">
              <UserCog aria-hidden="true" className="size-4" />
              システム（自動）
            </span>
          )}
          <span className={cn('text-sm', alert && 'font-bold text-danger')}>
            {ACTIONS[item.action] ?? item.action}
          </span>
          {target &&
            (link ? (
              <Link
                to={link}
                className="inline-flex items-center gap-1 border border-line px-1.5 text-xs font-bold text-link hover:border-link"
              >
                {target}を開く
                <ArrowRight aria-hidden="true" className="size-3" />
              </Link>
            ) : (
              <span className="bg-column px-1.5 text-xs text-ink-sub">{target}</span>
            ))}
        </div>
        {item.changes.length > 0 && <Changes changes={item.changes} />}
      </div>
    </li>
  );
}

/** Changed fields as a small before → after table. */
function Changes({ changes }: { changes: AuditChangeDto[] }) {
  return (
    <dl className="mt-2 grid grid-cols-[minmax(5rem,auto)_1fr] border border-line text-xs">
      {changes.map((change) => {
        const before = readable(change.before);
        const after = readable(change.after);
        return (
          <div key={change.field} className="contents">
            <dt className="border-b border-line bg-column px-2.5 py-1.5 font-bold text-ink-sub [&:nth-last-child(2)]:border-b-0">
              {FIELDS[change.field] ?? change.field}
            </dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-1.5 border-b border-line px-2.5 py-1.5 last:border-b-0">
              {before !== null && (
                <span className="bg-danger-soft px-1.5 text-danger line-through decoration-danger/50">
                  {before}
                </span>
              )}
              {before !== null && (
                <ArrowRight aria-hidden="true" className="size-3 shrink-0 text-ink-disabled" />
              )}
              {after !== null ? (
                <span className="bg-success-soft px-1.5 text-success">{after}</span>
              ) : (
                <span className="text-ink-disabled">（なし）</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
