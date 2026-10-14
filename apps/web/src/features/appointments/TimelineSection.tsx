import type { AppointmentDetail } from '@telesales/shared';
import { Card } from '@/components/ui/Card';
import { formatDateTime, formatRange } from '@/lib/format';
import { ja } from '@/i18n/ja';

interface Entry {
  at: string;
  who: string | null;
  text: string;
}

/** Everything that happened to this appointment, in time order (spec §2-2). */
export function TimelineSection({ appointment }: { appointment: AppointmentDetail }) {
  const entries: Entry[] = [
    {
      at: appointment.createdAt,
      who: appointment.bookedBy.name,
      text: `アポを登録（${ja.source[appointment.source]}）`,
    },
    ...(appointment.salesConfirmedAt
      ? [{ at: appointment.salesConfirmedAt, who: null, text: '営業の確認済み' }]
      : []),
    ...(appointment.dayBeforeCheckedAt && appointment.dayBeforeResult
      ? [
          {
            at: appointment.dayBeforeCheckedAt,
            who: appointment.dayBeforeCheckedBy?.name ?? null,
            text: `前日確認：${ja.dayBefore[appointment.dayBeforeResult]}`,
          },
        ]
      : []),
    ...appointment.changes.map((change) => {
      const before = change.before;
      const after = change.after;
      const moved = before.startsAt && after.startsAt && before.endsAt && after.endsAt;
      const text =
        after.status === 'CANCELLED'
          ? `取り消し${typeof after.note === 'string' && after.note ? `（${after.note}）` : ''}`
          : `${change.reason ? `【${ja.changeReason[change.reason]}】` : ''}${moved ? `${formatRange(before.startsAt ?? '', before.endsAt ?? '')} → ${formatRange(after.startsAt ?? '', after.endsAt ?? '')}` : '変更'}${before.salesRep && after.salesRep && before.salesRep.id !== after.salesRep.id ? `／担当営業 ${before.salesRep.name} → ${after.salesRep.name}` : ''}`;
      return { at: change.createdAt, who: change.changedBy.name, text };
    }),
    ...appointment.changeRequests.flatMap((request) => [
      {
        at: request.createdAt,
        who: request.requestedBy.name,
        text: `変更依頼：${request.message}`,
      },
      ...(request.takenAt
        ? [
            {
              at: request.takenAt,
              who: request.handler?.name ?? null,
              text: '変更依頼に「対応する」',
            },
          ]
        : []),
      ...(request.doneAt
        ? [{ at: request.doneAt, who: request.handler?.name ?? null, text: '変更依頼に対応済み' }]
        : []),
    ]),
    ...appointment.emails
      .filter((email) => email.sentAt)
      .map((email) => ({
        at: email.sentAt ?? '',
        who: email.createdBy?.name ?? 'システム',
        text: `メール送信：${email.subject}`,
      })),
    ...appointment.preparations.map((p) => ({
      at: p.createdAt,
      who: p.author.name,
      text: '営業の準備を追加',
    })),
    ...appointment.results.map((r) => ({
      at: r.createdAt,
      who: r.author.name,
      text: '打ち合わせ結果を入力',
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <Card title="経過">
      <ol className="relative flex flex-col gap-3 border-l-2 border-line pl-4">
        {entries.map((entry, index) => (
          <li key={`${entry.at}-${index}`} className="relative">
            <span className="absolute top-1.5 -left-[23px] size-3 rounded-full border-2 border-surface bg-main" />
            <p className="text-sm">{entry.text}</p>
            <p className="text-xs text-ink-sub">
              {formatDateTime(entry.at)}
              {entry.who ? `・${entry.who}` : ''}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
