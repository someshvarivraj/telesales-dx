import type { AssistantStep } from '@telesales/shared';

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : '');
const mmdd = (date: unknown) => {
  const value = text(date);
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${Number(value.slice(5, 7))}/${Number(value.slice(8))}`
    : value;
};
const who = (person: unknown) => {
  const name = text(person);
  return !name || ['自分', '私', 'わたし', 'me'].includes(name) ? 'ご自身' : `${name}さん`;
};

/** What MoraBot was doing, in the words shown in the work log while it answers. */
function describe(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'get_my_todos':
      return '今日やることを確認';
    case 'get_schedule':
      return `${who(args.person)}の予定を確認（${mmdd(args.from)}〜${mmdd(args.to)}）`;
    case 'search_appointments':
      return text(args.query) ? `「${text(args.query)}」のアポを検索` : 'アポを検索';
    case 'get_day_before_list':
      return '前日確認の一覧を確認';
    case 'find_free_slots':
      return `${who(args.person)}の${mmdd(args.date)}の空き時間を確認`;
    case 'propose_plan':
      return `予定「${text(args.title)}」の内容をチェック`;
    case 'propose_slot_hold':
      return `${who(args.person)}の${mmdd(args.date)} ${text(args.start)}の枠をチェック`;
    case 'propose_appointment':
      return `「${text(args.company)}」のアポ（${mmdd(args.date)} ${text(args.start)}）をチェック`;
    case 'propose_call_result':
      return `「${text(args.company)}」の架電結果を下書き`;
    case 'propose_change_request':
      return `「${text(args.company)}」の変更依頼を下書き`;
    case 'open_screen':
      return `画面を開く（${text(args.path)}）`;
    case 'ask_user':
      return '確認したいことを整理';
    default:
      return '調べもの';
  }
}

/** Why a tool came back without a result, briefly. */
function failure(result: unknown): string | null {
  if (typeof result !== 'object' || result === null || !('error' in result)) return null;
  const { error } = result as { error: unknown };
  switch (error) {
    case 'slot_unavailable':
      return 'その時間は入れられません';
    case 'not_allowed':
      return '権限がありません';
    case 'several_match':
      return '候補が複数あります';
    case 'person_not_found':
    case 'company_not_found':
    case 'appointment_not_found':
      return '見つかりませんでした';
    default:
      return 'できませんでした';
  }
}

export function stepFor(name: string, args: unknown, result: unknown): AssistantStep {
  const base = describe(name, (args ?? {}) as Record<string, unknown>);
  const problem = failure(result);
  return problem ? { text: `${base} → ${problem}`, ok: false } : { text: base, ok: true };
}
