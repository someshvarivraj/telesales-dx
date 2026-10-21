import type { SlotProblem } from '@telesales/shared';
import { formatDate, formatRange } from '@/lib/format';

/** One line per reason a slot cannot be used. */
export function slotProblemText(problem: unknown): string {
  const value = problem as SlotProblem;
  switch (value.kind) {
    case 'NOT_BUSINESS_DAY':
      return `${formatDate(value.date)}は${value.name ?? '土日'}のため入れられません。`;
    case 'TIME_OFF':
      return `お休みの時間です（${formatRange(value.startsAt, value.endsAt)}）。`;
    case 'SALES_BLOCK':
      return `埋まり（営業枠）：営業がテレマアポ停止にしている時間です（${formatRange(value.startsAt, value.endsAt)}）。`;
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
