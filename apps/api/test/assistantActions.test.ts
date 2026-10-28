import { type AssistantProposal, Permission } from '@telesales/shared';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import type { AssistantConfig } from '../src/config/AppConfig.js';
import type { Actor } from '../src/domain/access/AccessPolicy.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { AppointmentQueryService } from '../src/modules/appointments/AppointmentQueryService.js';
import { AssistantActions } from '../src/modules/assistant/AssistantActions.js';
import { AssistantService } from '../src/modules/assistant/AssistantService.js';
import type { AssistantTools } from '../src/modules/assistant/AssistantTools.js';
import type { SlotGuard } from '../src/modules/schedule/SlotGuard.js';

const REP = { id: '11111111-1111-4111-8111-111111111111', name: '営業 一郎' };
const COMPANY = {
  id: '22222222-2222-4222-8222-222222222222',
  name: '試験工業株式会社',
  office: null,
};
const clock = { now: () => new Date('2026-10-28T01:00:00Z') };

function actorWith(...permissions: string[]): Actor {
  return {
    id: 'u1',
    can: (permission: string) => permissions.includes(permission),
    hasRole: () => false,
  } as unknown as Actor;
}

const prisma = {
  user: {
    findMany: async () => [REP, { id: 'x', name: '別の 人' }],
    findUnique: async () => REP,
  },
  optionItem: { findUnique: async () => ({ isActive: true, label: '訪問' }) },
  company: { findMany: async () => [COMPANY] },
} as unknown as PrismaClient;

/** A guard where only the listed JST start times are taken. */
function guardWith(busyStartsUtc: string[] = []) {
  const checks: { startsAt: Date; kind: string }[] = [];
  const guard = {
    check: async (input: { startsAt: Date; kind: string }) => {
      checks.push(input);
      const busy = busyStartsUtc.includes(input.startsAt.toISOString());
      return busy
        ? {
            ok: false,
            problems: [{ kind: 'OVERLAP', title: '社内会議', startsAt: '', endsAt: '' }],
            warnings: [],
          }
        : { ok: true, problems: [], warnings: [] };
    },
  } as unknown as SlotGuard;
  return { guard, checks };
}

const actions = (guard: SlotGuard) =>
  new AssistantActions({ prisma, clock, guard, queries: {} as AppointmentQueryService });

describe('MoraBot actions', () => {
  it('proposes a plan with JST times and saves nothing', async () => {
    const { guard } = guardWith();
    const result = (await actions(guard).run(
      actorWith(Permission.WriteSalesPlans),
      'propose_plan',
      {
        person: '営業',
        date: '2026-11-03',
        start: '10:00',
        end: '11:00',
        type: 'VISIT',
        title: '打ち合わせ',
      },
    )) as { proposal: AssistantProposal };
    expect(result.proposal.kind).toBe('plan');
    expect(result.proposal.request).toEqual({
      path: '/plans',
      body: {
        ownerId: REP.id,
        type: 'VISIT',
        title: '打ち合わせ',
        startsAt: '2026-11-03T01:00:00.000Z',
        endsAt: '2026-11-03T02:00:00.000Z',
      },
    });
    expect(result.proposal.lines).toContainEqual({ label: '誰の予定', value: '営業 一郎さん' });
  });

  it('refuses a plan for someone without plan rights', async () => {
    const { guard } = guardWith();
    const result = await actions(guard).run(actorWith(), 'propose_plan', {
      person: '営業',
      date: '2026-11-03',
      start: '10:00',
      end: '11:00',
      type: 'VISIT',
      title: '打ち合わせ',
    });
    expect(result).toMatchObject({ error: 'not_allowed' });
  });

  it('passes on why a slot cannot be used', async () => {
    const { guard } = guardWith(['2026-11-03T01:00:00.000Z']);
    const result = await actions(guard).run(
      actorWith(Permission.ManageTelemaAppointments),
      'propose_slot_hold',
      { person: '営業', date: '2026-11-03', start: '10:00' },
    );
    expect(result).toEqual({
      error: 'slot_unavailable',
      problems: ['「社内会議」と重なっています（移動時間を含む）'],
    });
  });

  it('holds a slot by opening the booking screen', async () => {
    const { guard } = guardWith();
    const result = (await actions(guard).run(
      actorWith(Permission.ManageTelemaAppointments),
      'propose_slot_hold',
      { person: '営業', date: '2026-11-03', start: '13:30', company: '試験工業' },
    )) as { proposal: AssistantProposal };
    expect(result.proposal.request).toBeNull();
    const link = new URL(result.proposal.link, 'https://app.invalid');
    expect(link.pathname).toBe('/schedule/book');
    expect(Object.fromEntries(link.searchParams)).toMatchObject({
      repId: REP.id,
      date: '2026-11-03',
      start: '13:30',
      end: '14:30',
      hold: '1',
      companyId: COMPANY.id,
    });
  });

  it('lists free slots and skips the busy ones', async () => {
    const { guard } = guardWith(['2026-11-03T01:00:00.000Z']);
    const result = (await actions(guard).run(actorWith(), 'find_free_slots', {
      person: '営業',
      date: '2026-11-03',
    })) as { free: string[] };
    expect(result.free[0]).toBe('09:00〜10:00');
    expect(result.free).not.toContain('10:00〜11:00');
    expect(result.free.at(-1)).toBe('17:00〜18:00');
  });

  it('drafts a call result for the company', async () => {
    const { guard } = guardWith();
    const result = (await actions(guard).run(
      actorWith(Permission.WriteCallRecords),
      'propose_call_result',
      { company: '試験工業', grade: 'B', resultDetail: '来月また連絡' },
    )) as { proposal: AssistantProposal };
    expect(result.proposal.request).toEqual({
      path: `/companies/${COMPANY.id}/call-records`,
      body: { grade: 'B', resultDetail: '来月また連絡' },
    });
  });
});

describe('MoraBot proposals in the chat', () => {
  it('shows the card to the person and tells the model it is not saved', async () => {
    const config: AssistantConfig = {
      baseUrl: 'https://example.invalid/v1',
      apiKey: 'test-key',
      model: 'test-model',
      reasoningEffort: undefined,
      timeoutMs: 5000,
    };
    const card: AssistantProposal = {
      id: 'p1',
      kind: 'plan',
      title: '予定を入れる',
      lines: [{ label: '件名', value: '打ち合わせ' }],
      warnings: [],
      request: { path: '/plans', body: { ownerId: REP.id } },
      link: '/schedule',
      confirmLabel: '確定して登録',
    };
    const bodies: { messages: { role: string; content?: string }[] }[] = [];
    const replies = [
      {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                { id: 'c1', type: 'function', function: { name: 'propose_plan', arguments: '{}' } },
              ],
            },
          },
        ],
      },
      { choices: [{ message: { content: '内容をご確認ください。' } }] },
    ];
    const fetchImpl = (async (_url: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      return new Response(JSON.stringify(replies.shift()), { status: 200 });
    }) as unknown as typeof fetch;
    const tools = { run: async () => ({ proposal: card }) } as unknown as AssistantTools;
    const service = new AssistantService(
      config,
      tools,
      clock,
      pino({ level: 'silent' }),
      fetchImpl,
    );
    const result = await service.chat(actorWith(), { name: '試験 花子', roleLabel: '営業' }, [
      { role: 'user', content: '来週火曜10時に予定を入れて' },
    ]);
    expect(result.proposals).toEqual([card]);
    const toolMessage = bodies[1]?.messages.at(-1)?.content ?? '';
    expect(JSON.parse(toolMessage)).toMatchObject({
      saved: false,
      shownToUserAsCard: '予定を入れる',
    });
    expect(toolMessage).not.toContain('/plans');
  });
});
