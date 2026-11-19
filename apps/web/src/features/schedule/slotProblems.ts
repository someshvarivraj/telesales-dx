import type { SlotProblem } from '@telesales/shared';
import { jstDate } from '@telesales/shared';
import { formatDate, formatRange, formatTime } from '@/lib/format';

/** 「11/19（木） 10:00〜11:00」, or 「11/19（木） 終日」 for whole days (11/19: was 00:00〜00:00). */
function rangeText(startsAt: string, endsAt: string): string {
  const whole = formatTime(startsAt) === '00:00' && formatTime(endsAt) === '00:00';
  if (!whole) return formatRange(startsAt, endsAt);
  const first = jstDate(new Date(startsAt));
  const last = jstDate(new Date(new Date(endsAt).getTime() - 1));
  return first === last
    ? `${formatDate(first)} 終日`
    : `${formatDate(first)}〜${formatDate(last)} 終日`;
}

/** One line per reason a slot cannot be used. */
export function slotProblemText(problem: unknown): string {
  const value = problem as SlotProblem;
  switch (value.kind) {
    case 'NOT_BUSINESS_DAY':
      return `${formatDate(value.date)}は${value.name ?? '土日'}のため入れられません。`;
    case 'TIME_OFF':
      return `お休みの時間です（${rangeText(value.startsAt, value.endsAt)}）。`;
    case 'SALES_BLOCK':
      return `営業予定あり：営業がテレマアポ停止にしている時間です（${rangeText(value.startsAt, value.endsAt)}）。`;
    case 'OVERLAP':
      return value.startsAt
        ? `「${value.title}」（${formatRange(value.startsAt, value.endsAt)}）と重なっています。`
        : 'ほかの予定と重なっています。';
    case 'LOCKED':
      return `${value.by}さんがこの時間帯を編集中です。`;
    case 'INVALID_TIME':
      return '開始と終了の時刻を確認してください（15分刻み・終了は開始より後）。';
    default:
      return 'この時間帯には入れられません。';
  }
}
