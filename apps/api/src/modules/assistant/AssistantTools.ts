import { addDays, jstDate } from '@telesales/shared';
import { z } from 'zod';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import type { Clock } from '../../domain/Clock.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { AppointmentQueryService } from '../appointments/AppointmentQueryService.js';
import type { DashboardService } from '../dashboard/DashboardService.js';
import type { ScheduleService } from '../schedule/ScheduleService.js';

/**
 * MoraBot's tools: read-only lookups that call the same services as the screens, as
 * the signed-in user (so it never sees more than that person could). Results are
 * compact JSON for the model, with in-app paths so it can link to the screen.
 */
export interface ToolDeps {
  prisma: PrismaClient;
  clock: Clock;
  dashboard: DashboardService;
  schedule: ScheduleService;
  queries: AppointmentQueryService;
}

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const time = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const at = (iso: string) => time.format(new Date(iso));

/** Tool list in the OpenAI-compatible `tools` format (Gemini's endpoint accepts it). */
export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_my_todos',
      description:
        'ログインしている人の「今日やること」の件数（今日の予定、確認していないアポ、結果を入れていないアポ、前日確認、変更依頼、新しい架電リスト、重複・要確認、割り振りなど）。',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_schedule',
      description:
        '営業などの予定・アポ・休みを期間で調べる。person は名前の一部（例「千原」）か「自分」。期間は最大31日。',
      parameters: {
        type: 'object',
        properties: {
          person: { type: 'string', description: '名前の一部、または「自分」' },
          from: { type: 'string', description: '開始日 YYYY-MM-DD（日本時間）' },
          to: { type: 'string', description: '終了日 YYYY-MM-DD（日本時間）' },
        },
        required: ['person', 'from', 'to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_appointments',
      description:
        'アポを探す。会社名・先方担当者の一部（query）、打ち合わせの期間、担当営業の名前で絞り込める。最大20件。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '会社名や先方担当者の一部' },
          from: { type: 'string', description: '打ち合わせ日（から）YYYY-MM-DD' },
          to: { type: 'string', description: '打ち合わせ日（まで）YYYY-MM-DD' },
          salesRep: { type: 'string', description: '担当営業の名前の一部' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_day_before_list',
      description: '前日確認の対象（翌営業日のテレマのアポ）と、それぞれの確認結果。',
      parameters: { type: 'object', properties: {} },
    },
  },
] as const;

export type ToolName = (typeof TOOL_DEFINITIONS)[number]['function']['name'];

const scheduleArgs = z.object({
  person: z.string().trim().min(1).max(50),
  from: dateString,
  to: dateString,
});
const searchArgs = z.object({
  query: z.string().trim().max(100).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  salesRep: z.string().trim().max(50).optional(),
});

export class AssistantTools {
  constructor(private readonly deps: ToolDeps) {}

  /** Runs one tool call; a bad argument or unknown person comes back as `{ error }`. */
  async run(actor: Actor, name: string, rawArgs: unknown): Promise<unknown> {
    switch (name as ToolName) {
      case 'get_my_todos':
        return this.todos(actor);
      case 'get_schedule': {
        const args = scheduleArgs.safeParse(rawArgs);
        return args.success ? this.scheduleFor(actor, args.data) : { error: 'invalid_arguments' };
      }
      case 'search_appointments': {
        const args = searchArgs.safeParse(rawArgs ?? {});
        return args.success ? this.searchAppointments(args.data) : { error: 'invalid_arguments' };
      }
      case 'get_day_before_list':
        return this.dayBefore();
      default:
        return { error: 'unknown_tool' };
    }
  }

  private async todos(actor: Actor) {
    const home = await this.deps.dashboard.home(actor);
    return { ...home, link: '/home' };
  }

  /** Active users whose name contains the text (spaces ignored); 「自分」 = the signed-in user. */
  private async findPeople(actor: Actor, person: string) {
    if (['自分', '私', 'わたし', 'me'].includes(person)) {
      const me = await this.deps.prisma.user.findUnique({
        where: { id: actor.id },
        select: { id: true, name: true },
      });
      return me ? [me] : [];
    }
    const needle = person.replace(/\s|さん|様/g, '');
    const users = await this.deps.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
    });
    return users.filter((user) => user.name.replace(/\s/g, '').includes(needle));
  }

  private async scheduleFor(actor: Actor, args: z.infer<typeof scheduleArgs>) {
    if (args.to < args.from || addDays(args.from, 31) < args.to) {
      return { error: 'range_must_be_1_to_31_days' };
    }
    const people = await this.findPeople(actor, args.person);
    if (people.length === 0) return { error: 'person_not_found', person: args.person };
    if (people.length > 1) {
      return { error: 'several_people_match', candidates: people.map((p) => p.name).slice(0, 10) };
    }
    const [target] = people;
    if (!target) return { error: 'person_not_found', person: args.person };
    const data = await this.deps.schedule.getSchedule(actor, args.from, args.to, [target.id]);
    const mine = (ids: string[]) => ids.includes(target.id);
    return {
      person: target.name,
      from: args.from,
      to: args.to,
      plans: data.plans
        .filter((plan) => mine([plan.owner.id, ...plan.attendees.map((a) => a.id)]))
        .map((plan) => ({
          title: plan.appointment ? `アポ：${plan.appointment.companyName}` : plan.title,
          start: at(plan.startsAt),
          end: at(plan.endsAt),
          allDay: plan.allDay,
          link: plan.appointment ? `/appointments/${plan.appointment.id}` : undefined,
        })),
      timeOff: data.timeOff
        .filter((row) => row.user.id === target.id)
        .map((row) => ({
          kind: row.kind,
          start: at(row.startsAt),
          end: at(row.endsAt),
          allDay: row.allDay,
        })),
      holidays: data.holidays,
      link: `/schedule?date=${args.from}`,
    };
  }

  private async searchAppointments(args: z.infer<typeof searchArgs>) {
    let salesRepId: string | undefined;
    if (args.salesRep) {
      const needle = args.salesRep.replace(/\s|さん|様/g, '');
      const reps = (
        await this.deps.prisma.user.findMany({
          where: { status: 'ACTIVE' },
          select: { id: true, name: true },
        })
      ).filter((user) => user.name.replace(/\s/g, '').includes(needle));
      if (reps.length !== 1) {
        return reps.length === 0
          ? { error: 'person_not_found', person: args.salesRep }
          : { error: 'several_people_match', candidates: reps.map((r) => r.name).slice(0, 10) };
      }
      salesRepId = reps[0]?.id;
    }
    const page = await this.deps.queries.list({
      q: args.query || undefined,
      from: args.from,
      to: args.to,
      salesRepId,
      page: 1,
      pageSize: 20,
    });
    return {
      total: page.total,
      items: page.items.map((item) => ({
        company: item.company.name,
        start: at(item.startsAt),
        salesRep: item.salesRep.name,
        bookedBy: item.bookedBy.name,
        status: item.status,
        salesConfirmed: Boolean(item.salesConfirmedAt),
        dayBefore: item.dayBeforeResult,
        hasResult: item.hasResult,
        link: `/appointments/${item.id}`,
      })),
    };
  }

  private async dayBefore() {
    const list = await this.deps.queries.dayBeforeList(jstDate(this.deps.clock.now()));
    return {
      checkDate: list.checkDate,
      meetingDates: list.dates,
      items: list.items.map((item) => ({
        company: item.company.name,
        start: at(item.startsAt),
        salesRep: item.salesRep.name,
        result: item.dayBeforeResult ?? '未入力',
        assignee: item.assignee?.name ?? null,
        link: `/appointments/${item.id}`,
      })),
      link: '/appointments/day-before',
    };
  }
}
