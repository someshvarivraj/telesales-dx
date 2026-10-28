import { randomUUID } from 'node:crypto';
import {
  type AssistantActionKind,
  addMinutes,
  AppointmentSource,
  fromJst,
  jstDate,
  OptionCategory,
  Permission,
  type SlotProblem,
} from '@telesales/shared';
import { z } from 'zod';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import type { Clock } from '../../domain/Clock.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { AppointmentQueryService } from '../appointments/AppointmentQueryService.js';
import type { AreaTableService } from '../area/AreaTableService.js';
import type { SlotGuard } from '../schedule/SlotGuard.js';
import { findCompany, findPerson, isLookupError } from './lookup.js';

/**
 * MoraBot's actions. The model never saves anything: these tools check the request
 * (person, time, permissions) and return a proposal card with the checked payload. The
 * payload stays on the server; when the person presses 確定, AssistantActionRunner runs
 * it through the same services as the screens.
 */
export interface ActionDeps {
  prisma: PrismaClient;
  clock: Clock;
  guard: SlotGuard;
  queries: AppointmentQueryService;
  area: AreaTableService;
}

/** A card before it is stored: what the person sees, plus what 確定 will run. */
export interface ProposedAction {
  id: string;
  kind: AssistantActionKind;
  title: string;
  lines: { label: string; value: string }[];
  warnings: string[];
  link: string;
  confirmLabel: string;
  /** Run on 確定 (see AssistantActionRunner); null for a slot hold. */
  payload: Record<string, unknown> | null;
}

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** HH:MM on the 15-minute grid the schedule uses. */
const timeString = z.string().regex(/^([01]\d|2[0-3]):(00|15|30|45)$/);

/** Hours MoraBot searches for free slots (JST). */
const DAY_START = '09:00';
const DAY_END = '18:00';

const label = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
});
const dayLabel = (date: string) => label.format(fromJst(date));

export const ACTION_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'find_free_slots',
      description:
        '営業の空いている時間（アポを入れられる枠）を1日分探す（9:00〜18:00、休み・テレマアポ停止・他の予定・移動時間を考慮）。',
      parameters: {
        type: 'object',
        properties: {
          person: { type: 'string', description: '営業の名前の一部、または「自分」' },
          date: { type: 'string', description: '日付 YYYY-MM-DD（日本時間）' },
          durationMinutes: { type: 'integer', description: '必要な長さ（分）。既定は60' },
        },
        required: ['person', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_plan',
      description:
        'スケジュールに予定（アポ以外）を入れる提案カードを出す。保存はされず、本人が「確定」を押したときだけ登録される。',
      parameters: {
        type: 'object',
        properties: {
          person: { type: 'string', description: '予定の持ち主（名前の一部、または「自分」）' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          start: { type: 'string', description: '開始 HH:MM（15分刻み）' },
          end: { type: 'string', description: '終了 HH:MM（15分刻み）' },
          type: {
            type: 'string',
            enum: ['VISIT', 'ONLINE', 'INTERNAL', 'TRIP', 'EVENT', 'OTHER'],
            description: '訪問／オンライン／社内／出張／展示会／その他',
          },
          title: { type: 'string', description: '予定の件名' },
          note: { type: 'string', description: 'メモ（任意）' },
        },
        required: ['person', 'date', 'start', 'end', 'type', 'title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_slot_hold',
      description:
        'アポ登録のために営業の枠を押さえる提案カードを出す。「確定」でアポ登録画面が開き、その枠が押さえられる（ほかの人は入れられなくなる）。',
      parameters: {
        type: 'object',
        properties: {
          person: { type: 'string', description: '担当営業の名前の一部' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          start: { type: 'string', description: '開始 HH:MM（15分刻み）' },
          end: { type: 'string', description: '終了 HH:MM（15分刻み）。既定は開始の60分後' },
          company: { type: 'string', description: 'アポ先の会社名（分かれば）' },
        },
        required: ['person', 'date', 'start'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_appointment',
      description:
        'アポを登録する提案カードを出す（新規リストの会社・テレマ、または営業が自分で取ったアポ）。担当営業を省くと営業担当表から自動で決める。「確定」で登録され、営業さんへのメール（N1）の確認画面が開く。会社名・日時・訪問形態がそろうまで ask_user で確認する。',
      parameters: {
        type: 'object',
        properties: {
          company: { type: 'string', description: '会社名（登録済みの会社）' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          start: { type: 'string', description: '開始 HH:MM（15分刻み）' },
          end: { type: 'string', description: '終了 HH:MM。既定は開始の60分後' },
          format: { type: 'string', enum: ['VISIT', 'ONLINE'], description: '訪問／オンライン' },
          salesRep: { type: 'string', description: '担当営業の名前（省くと営業担当表で判定）' },
          contactName: { type: 'string', description: '先方担当者' },
          contactDepartment: { type: 'string', description: '先方の部署' },
          contactPhone: { type: 'string', description: '先方の電話' },
          visitAddress: { type: 'string', description: '訪問先住所（訪問のとき）' },
          handoverNotes: { type: 'string', description: '営業さんへの伝達事項' },
        },
        required: ['company', 'date', 'start', 'format'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_call_result',
      description:
        '架電結果の下書きカードを出す。「確定」を押したときだけ保存される。判定 A=アポ獲得 B=保留 C=不可 D=不通。',
      parameters: {
        type: 'object',
        properties: {
          company: { type: 'string', description: '会社名' },
          grade: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
          resultDetail: { type: 'string', description: '結果詳細（話した内容）' },
          contactName: { type: 'string', description: '先方担当者' },
          nextCallDate: { type: 'string', description: '次回架電日 YYYY-MM-DD（任意）' },
          notes: { type: 'string', description: 'メモ（任意）' },
        },
        required: ['company', 'grade'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_change_request',
      description:
        '営業からアポの日時変更を依頼する提案カードを出す（テレマ全員に届く）。「確定」を押したときだけ送られる。',
      parameters: {
        type: 'object',
        properties: {
          company: { type: 'string', description: 'アポ先の会社名' },
          date: { type: 'string', description: 'いまのアポの日付 YYYY-MM-DD（分かれば）' },
          message: { type: 'string', description: '依頼の内容（希望の日時・理由）' },
        },
        required: ['company', 'message'],
      },
    },
  },
] as const;

export type ActionName = (typeof ACTION_DEFINITIONS)[number]['function']['name'];
export const ACTION_NAMES: readonly string[] = ACTION_DEFINITIONS.map((tool) => tool.function.name);

const freeArgs = z.object({
  person: z.string().trim().min(1).max(50),
  date: dateString,
  durationMinutes: z.number().int().min(15).max(480).multipleOf(15).default(60),
});
const planArgs = z.object({
  person: z.string().trim().min(1).max(50),
  date: dateString,
  start: timeString,
  end: timeString,
  type: z.enum(['VISIT', 'ONLINE', 'INTERNAL', 'TRIP', 'EVENT', 'OTHER']),
  title: z.string().trim().min(1).max(200),
  note: z.string().trim().max(2000).optional(),
});
const holdArgs = z.object({
  person: z.string().trim().min(1).max(50),
  date: dateString,
  start: timeString,
  end: timeString.optional(),
  company: z.string().trim().max(200).optional(),
});
const appointmentArgs = z.object({
  company: z.string().trim().min(1).max(200),
  date: dateString,
  start: timeString,
  end: timeString.optional(),
  format: z.enum(['VISIT', 'ONLINE']),
  salesRep: z.string().trim().max(50).optional(),
  contactName: z.string().trim().max(100).optional(),
  contactDepartment: z.string().trim().max(100).optional(),
  contactPhone: z.string().trim().max(64).optional(),
  visitAddress: z.string().trim().max(300).optional(),
  handoverNotes: z.string().trim().max(10_000).optional(),
});
const callArgs = z.object({
  company: z.string().trim().min(1).max(200),
  grade: z.enum(['A', 'B', 'C', 'D']),
  resultDetail: z.string().trim().max(2000).optional(),
  contactName: z.string().trim().max(100).optional(),
  nextCallDate: dateString.optional(),
  notes: z.string().trim().max(4000).optional(),
});
const changeArgs = z.object({
  company: z.string().trim().min(1).max(200),
  date: dateString.optional(),
  message: z.string().trim().min(1).max(2000),
});

const GRADE_LABEL: Record<string, string> = { A: 'アポ獲得', B: '保留', C: '不可', D: '不通' };

/** The slot problems in words the model can pass on. */
function problemText(problem: SlotProblem): string {
  switch (problem.kind) {
    case 'NOT_BUSINESS_DAY':
      return `${problem.name ?? '土日'}のため入れられません`;
    case 'TIME_OFF':
      return 'お休みの時間です';
    case 'SALES_BLOCK':
      return 'テレマアポ停止の時間です';
    case 'OVERLAP':
      return `「${problem.title}」と重なっています（移動時間を含む）`;
    case 'LOCKED':
      return `${problem.by}さんがこの時間帯を編集中です`;
    case 'INVALID_TIME':
      return '時刻が正しくありません（15分刻み・終了は開始より後）';
    default:
      return 'この時間帯には入れられません';
  }
}

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export class AssistantActions {
  constructor(private readonly deps: ActionDeps) {}

  /** Runs one action tool; a refusal comes back as `{ error }` for the model to explain. */
  async run(actor: Actor, name: string, rawArgs: unknown): Promise<unknown> {
    const parse = <T>(schema: z.ZodType<T>) => schema.safeParse(rawArgs ?? {});
    switch (name as ActionName) {
      case 'find_free_slots': {
        const args = parse(freeArgs);
        return args.success ? this.freeSlots(actor, args.data) : { error: 'invalid_arguments' };
      }
      case 'propose_plan': {
        const args = parse(planArgs);
        return args.success ? this.proposePlan(actor, args.data) : { error: 'invalid_arguments' };
      }
      case 'propose_slot_hold': {
        const args = parse(holdArgs);
        return args.success ? this.proposeHold(actor, args.data) : { error: 'invalid_arguments' };
      }
      case 'propose_appointment': {
        const args = parse(appointmentArgs);
        return args.success
          ? this.proposeAppointment(actor, args.data)
          : { error: 'invalid_arguments' };
      }
      case 'propose_call_result': {
        const args = parse(callArgs);
        return args.success
          ? this.proposeCallResult(actor, args.data)
          : { error: 'invalid_arguments' };
      }
      case 'propose_change_request': {
        const args = parse(changeArgs);
        return args.success
          ? this.proposeChangeRequest(actor, args.data)
          : { error: 'invalid_arguments' };
      }
      default:
        return { error: 'unknown_tool' };
    }
  }

  private async freeSlots(actor: Actor, args: z.infer<typeof freeArgs>) {
    const rep = await findPerson(this.deps.prisma, actor.id, args.person);
    if (isLookupError(rep)) return rep;
    if (args.date < jstDate(this.deps.clock.now())) return { error: 'date_in_the_past' };
    const free: string[] = [];
    const last = minutesOf(DAY_END) - args.durationMinutes;
    for (let start = minutesOf(DAY_START); start <= last; start += 30) {
      const startsAt = fromJst(args.date, hhmm(start));
      const result = await this.deps.guard.check({
        salesRepId: rep.id,
        startsAt,
        endsAt: addMinutes(startsAt, args.durationMinutes),
        actorId: actor.id,
        kind: 'APPOINTMENT',
      });
      const closed = result.problems.find((problem) => problem.kind === 'NOT_BUSINESS_DAY');
      if (closed) return { person: rep.name, date: args.date, closed: problemText(closed) };
      if (result.ok) free.push(`${hhmm(start)}〜${hhmm(start + args.durationMinutes)}`);
    }
    return {
      person: rep.name,
      date: args.date,
      day: dayLabel(args.date),
      durationMinutes: args.durationMinutes,
      free,
      link: `/schedule?date=${args.date}`,
    };
  }

  private async proposePlan(actor: Actor, args: z.infer<typeof planArgs>) {
    if (!actor.can(Permission.WriteSalesPlans) && !actor.can(Permission.Administer)) {
      return { error: 'not_allowed', reason: '予定を入れられるのは営業と管理者です' };
    }
    const owner = await findPerson(this.deps.prisma, actor.id, args.person);
    if (isLookupError(owner)) return owner;
    const type = await this.deps.prisma.optionItem.findUnique({
      where: { category_code: { category: OptionCategory.PlanType, code: args.type } },
    });
    if (!type?.isActive) return { error: 'invalid_plan_type' };
    const startsAt = fromJst(args.date, args.start);
    const endsAt = fromJst(args.date, args.end);
    const check = await this.deps.guard.check({
      salesRepId: owner.id,
      startsAt,
      endsAt,
      actorId: actor.id,
      kind: 'PLAN',
    });
    if (!check.ok) {
      return { error: 'slot_unavailable', problems: check.problems.map(problemText) };
    }
    return this.proposal({
      kind: 'plan',
      title: '予定を入れる',
      lines: [
        { label: '誰の予定', value: `${owner.name}さん` },
        { label: '日時', value: `${dayLabel(args.date)} ${args.start}〜${args.end}` },
        { label: '種類', value: type.label },
        { label: '件名', value: args.title },
        ...(args.note ? [{ label: 'メモ', value: args.note }] : []),
      ],
      warnings: check.warnings,
      payload: {
        body: {
          ownerId: owner.id,
          type: args.type,
          title: args.title,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          ...(args.note ? { note: args.note } : {}),
        },
      },
      link: `/schedule?date=${args.date}`,
      confirmLabel: '確定して登録',
    });
  }

  private async proposeHold(actor: Actor, args: z.infer<typeof holdArgs>) {
    const canBook = [
      Permission.ManageTelemaAppointments,
      Permission.ManageSalesAppointments,
      Permission.Administer,
    ].some((permission) => actor.can(permission));
    if (!canBook) return { error: 'not_allowed', reason: '枠を押さえられるのはテレマ・営業です' };
    const rep = await findPerson(this.deps.prisma, actor.id, args.person);
    if (isLookupError(rep)) return rep;
    const company = args.company ? await findCompany(this.deps.prisma, args.company) : null;
    if (isLookupError(company)) return company;
    const end = args.end ?? hhmm(minutesOf(args.start) + 60);
    const startsAt = fromJst(args.date, args.start);
    const endsAt = fromJst(args.date, end);
    const check = await this.deps.guard.check({
      salesRepId: rep.id,
      startsAt,
      endsAt,
      actorId: actor.id,
      kind: 'APPOINTMENT',
    });
    if (!check.ok) {
      return { error: 'slot_unavailable', problems: check.problems.map(problemText) };
    }
    const params = new URLSearchParams({
      repId: rep.id,
      date: args.date,
      start: args.start,
      end,
      hold: '1',
      ...(company ? { companyId: company.id, source: 'CALL_STATUS' } : {}),
    });
    return this.proposal({
      kind: 'booking',
      title: 'アポの枠を押さえる',
      lines: [
        { label: '担当営業', value: `${rep.name}さん` },
        { label: '日時', value: `${dayLabel(args.date)} ${args.start}〜${end}` },
        ...(company ? [{ label: 'アポ先', value: company.name }] : []),
      ],
      warnings: check.warnings,
      payload: null,
      link: `/schedule/book?${params.toString()}`,
      confirmLabel: '枠を押さえて登録画面へ',
    });
  }

  private async proposeCallResult(actor: Actor, args: z.infer<typeof callArgs>) {
    if (!actor.can(Permission.WriteCallRecords)) {
      return { error: 'not_allowed', reason: '架電結果を入れられるのはテレマです' };
    }
    const company = await findCompany(this.deps.prisma, args.company);
    if (isLookupError(company)) return company;
    const body = {
      grade: args.grade,
      ...(args.resultDetail ? { resultDetail: args.resultDetail } : {}),
      ...(args.contactName ? { contactName: args.contactName } : {}),
      ...(args.nextCallDate ? { nextCallDate: args.nextCallDate } : {}),
      ...(args.notes ? { notes: args.notes } : {}),
    };
    return this.proposal({
      kind: 'callResult',
      title: '架電結果を保存する',
      lines: [
        { label: '会社', value: company.name },
        { label: '判定', value: `${args.grade} ${GRADE_LABEL[args.grade] ?? ''}` },
        ...(args.resultDetail ? [{ label: '結果詳細', value: args.resultDetail }] : []),
        ...(args.contactName ? [{ label: '先方担当者', value: args.contactName }] : []),
        ...(args.nextCallDate ? [{ label: '次回架電日', value: dayLabel(args.nextCallDate) }] : []),
        ...(args.notes ? [{ label: 'メモ', value: args.notes }] : []),
      ],
      warnings:
        args.grade === 'A'
          ? ['保存のあと、企業のページで「担当営業を判定してアポを登録する」に進んでください。']
          : [],
      payload: { companyId: company.id, body },
      link: `/companies/${company.id}`,
      confirmLabel: '確定して保存',
    });
  }

  private async proposeChangeRequest(actor: Actor, args: z.infer<typeof changeArgs>) {
    const today = jstDate(this.deps.clock.now());
    const page = await this.deps.queries.list({
      q: args.company,
      from: args.date ?? today,
      to: args.date,
      status: 'SCHEDULED',
      page: 1,
      pageSize: 6,
    });
    const [only] = page.items;
    if (!only || page.items.length > 1) {
      return page.items.length === 0
        ? { error: 'appointment_not_found', company: args.company }
        : {
            error: 'several_match',
            candidates: page.items.map((item) => `${item.company.name}（${item.startsAt}）`),
          };
    }
    const detail = await this.deps.queries.detail(actor, only.id);
    if (!detail.abilities.requestChange) {
      return { error: 'not_allowed', reason: '変更依頼を出せるのは、そのアポの担当営業などです' };
    }
    return this.proposal({
      kind: 'changeRequest',
      title: '変更依頼を出す',
      lines: [
        { label: 'アポ', value: `${only.company.name}（${only.salesRep.name}さん）` },
        {
          label: 'いまの日時',
          value: `${dayLabel(jstDate(new Date(only.startsAt)))} ${new Date(
            only.startsAt,
          ).toLocaleTimeString('ja-JP', {
            timeZone: 'Asia/Tokyo',
            hour: '2-digit',
            minute: '2-digit',
          })}`,
        },
        { label: '依頼の内容', value: args.message },
      ],
      warnings: ['送るとテレマ全員にお知らせが届きます。'],
      payload: { appointmentId: only.id, message: args.message },
      link: `/appointments/${only.id}`,
      confirmLabel: '確定して送る',
    });
  }

  private async proposeAppointment(actor: Actor, args: z.infer<typeof appointmentArgs>) {
    const telema = actor.can(Permission.ManageTelemaAppointments);
    const sales = actor.can(Permission.ManageSalesAppointments);
    const admin = actor.can(Permission.Administer);
    if (!telema && !sales && !admin) {
      return { error: 'not_allowed', reason: 'アポを登録できるのはテレマ・営業です' };
    }
    const found = await findCompany(this.deps.prisma, args.company);
    if (isLookupError(found)) return found;
    const company = await this.deps.prisma.company.findUnique({
      where: { id: found.id },
      select: { id: true, customerType: true, listName: true, department: true, address: true },
    });
    if (!company) return { error: 'company_not_found', name: args.company };

    // Telemarketing books for the rep from the area table; sales book for themselves.
    const source = telema || admin ? AppointmentSource.CallStatus : AppointmentSource.SalesBooked;
    let rep: { id: string; name: string };
    let repReason: string | null = null;
    if (source === AppointmentSource.SalesBooked) {
      const me = await findPerson(this.deps.prisma, actor.id, '自分');
      if (isLookupError(me)) return me;
      rep = me;
    } else if (args.salesRep) {
      const named = await findPerson(this.deps.prisma, actor.id, args.salesRep);
      if (isLookupError(named)) return named;
      rep = named;
    } else {
      const suggestion = await this.deps.area.findRep({ companyId: company.id });
      if (!suggestion.rep) {
        return { error: 'no_rep_in_area_table', hint: '担当営業の名前を聞いてください' };
      }
      rep = suggestion.rep;
      repReason = suggestion.matchedBy;
    }

    const end = args.end ?? hhmm(minutesOf(args.start) + 60);
    const startsAt = fromJst(args.date, args.start);
    const endsAt = fromJst(args.date, end);
    const check = await this.deps.guard.check({
      salesRepId: rep.id,
      startsAt,
      endsAt,
      actorId: actor.id,
      kind: 'APPOINTMENT',
      salesBooked: source === AppointmentSource.SalesBooked,
    });
    if (!check.ok) {
      return { error: 'slot_unavailable', problems: check.problems.map(problemText) };
    }

    // Like the booking screen: the latest call record fills in the contact and the notes.
    const latest = await this.deps.prisma.callRecord.findFirst({
      where: { companyId: company.id },
      orderBy: { calledAt: 'desc' },
      select: { id: true, contactName: true, resultDetail: true, notes: true },
    });
    const contactName = args.contactName ?? latest?.contactName ?? undefined;
    const handoverNotes =
      args.handoverNotes ??
      ([latest?.resultDetail, latest?.notes].filter(Boolean).join('\n') || undefined);
    const visitAddress =
      args.format === 'VISIT' ? (args.visitAddress ?? company.address ?? undefined) : undefined;
    const contactDepartment = args.contactDepartment ?? company.department ?? undefined;
    const body = {
      source,
      companyId: company.id,
      sourceCallRecordId: source === AppointmentSource.CallStatus ? (latest?.id ?? null) : null,
      salesRepId: rep.id,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      format: args.format,
      visitAddress: visitAddress ?? null,
      contactName: contactName ?? null,
      contactDepartment: contactDepartment ?? null,
      contactPhone: args.contactPhone ?? null,
      handoverNotes: handoverNotes ?? null,
      customerType: company.customerType,
      listName: company.listName,
    };
    const optional = (label: string, value: string | null | undefined) =>
      value ? [{ label, value }] : [];
    return this.proposal({
      kind: 'appointment',
      title: 'アポを登録する',
      lines: [
        { label: 'アポ先', value: found.name },
        { label: '日時', value: `${dayLabel(args.date)} ${args.start}〜${end}` },
        { label: '訪問形態', value: args.format === 'VISIT' ? '訪問' : 'オンライン' },
        {
          label: '担当営業',
          value: repReason ? `${rep.name}さん（営業担当表：${repReason}）` : `${rep.name}さん`,
        },
        ...optional('訪問先', visitAddress),
        ...optional('先方担当者', contactName),
        ...optional('先方の部署', contactDepartment),
        ...optional('先方の電話', args.contactPhone),
        ...optional('伝達事項', handoverNotes),
      ],
      warnings: [
        ...check.warnings,
        '登録すると担当営業にお知らせが届き、続けて営業さんへのメール（N1）の確認画面が開きます。',
      ],
      payload: { body },
      link: `/companies/${company.id}`,
      confirmLabel: '確定してアポを登録',
    });
  }

  private proposal(card: Omit<ProposedAction, 'id'>): { proposal: ProposedAction } {
    return { proposal: { id: randomUUID(), ...card } };
  }
}
