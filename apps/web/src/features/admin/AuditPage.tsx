import type { AuditLogDto } from '@telesales/shared';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { DatePicker } from '@/components/ui/DatePicker';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { QueryState } from '@/components/ui/QueryState';
import { Select } from '@/components/ui/Select';
import { formatDateTime, todayJst } from '@/lib/format';
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
};

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

/**
 * 操作履歴 (Q-09, 10/20): the recent history on screen — who, when, what, and the
 * fields that changed. Older history is extracted on request by an engineer.
 */
export function AuditPage() {
  const [filter, setFilter] = useState({
    targetType: '',
    actorId: '',
    from: daysAgo(6),
    to: todayJst(),
  });
  const users = useAdminUsers();
  const query = useAuditLog({
    targetType: filter.targetType || undefined,
    actorId: filter.actorId || undefined,
    from: filter.from || undefined,
    to: filter.to || undefined,
  });

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="対象">
            {(c) => (
              <Select
                {...c}
                value={filter.targetType}
                placeholder="すべて"
                options={Object.entries(TARGETS).map(([value, label]) => ({ value, label }))}
                onChange={(e) => setFilter({ ...filter, targetType: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="誰">
            {(c) => (
              <Select
                {...c}
                value={filter.actorId}
                placeholder="全員"
                options={(users.data ?? []).map((user) => ({ value: user.id, label: user.name }))}
                onChange={(e) => setFilter({ ...filter, actorId: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="期間（から）">
            {(c) => (
              <DatePicker
                {...c}
                value={filter.from}
                onChange={(e) => setFilter({ ...filter, from: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="期間（まで）">
            {(c) => (
              <DatePicker
                {...c}
                value={filter.to}
                onChange={(e) => setFilter({ ...filter, to: e.target.value })}
              />
            )}
          </FormField>
        </div>
      </Card>

      <QueryState query={query}>
        {(data) => (
          <>
            <p className="text-sm text-ink-sub">
              画面で見られるのは直近{data.days}
              日分です。それより前の履歴は、管理者からシステム担当に依頼して出します。
            </p>
            {data.truncated && (
              <Alert tone="info">
                件数が多いため、新しい順に一部だけ表示しています。期間や対象を絞ってください。
              </Alert>
            )}
            <Card flush>
              {data.items.length === 0 ? (
                <EmptyState>この条件の履歴はありません。</EmptyState>
              ) : (
                <ul className="divide-y divide-line">
                  {data.items.map((item) => (
                    <AuditRow key={item.id} item={item} />
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </QueryState>
    </div>
  );
}

function AuditRow({ item }: { item: AuditLogDto }) {
  const link = targetLink(item);
  const target = item.targetType ? (TARGETS[item.targetType] ?? item.targetType) : null;
  return (
    <li className="flex flex-col gap-1.5 px-5 py-3.5 max-sm:px-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm whitespace-nowrap text-ink-sub tabular-nums">
          {formatDateTime(item.createdAt)}
        </span>
        <span className="text-sm font-bold">{item.actor?.name ?? 'システム（自動）'}</span>
        <span className="text-sm">{ACTIONS[item.action] ?? item.action}</span>
        {target &&
          (link ? (
            <Link to={link} className="text-sm text-link hover:underline">
              {target}を開く
            </Link>
          ) : (
            <span className="text-xs text-ink-sub">（{target}）</span>
          ))}
      </div>
      {item.changes.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          {item.changes.map((change) => (
            <div key={change.field} className="contents">
              <dt className="text-ink-sub">{FIELDS[change.field] ?? change.field}</dt>
              <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
                {change.before !== null && (
                  <span className="text-ink-sub line-through decoration-ink-disabled">
                    {change.before}
                  </span>
                )}
                {change.before !== null && change.after !== null && (
                  <ArrowRight aria-hidden="true" className="size-3 text-ink-disabled" />
                )}
                <span className="text-ink">{change.after ?? '（なし）'}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}
