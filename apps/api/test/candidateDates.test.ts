import { describe, expect, it } from 'vitest';
import type { AccessPolicy, Actor } from '../src/domain/access/AccessPolicy.js';
import type { AuditLogger } from '../src/domain/audit/AuditLogger.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { NotificationService } from '../src/modules/notifications/NotificationService.js';
import type { SettingsService } from '../src/modules/settings/SettingsService.js';
import { ScheduleService } from '../src/modules/schedule/ScheduleService.js';
import type { SlotGuard } from '../src/modules/schedule/SlotGuard.js';

const REP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const person = { id: REP, name: '千原' };

function setup() {
  const created: Record<string, unknown>[] = [];
  const tx = {
    schedulePlan: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return {
          ...data,
          id: `p${created.length}`,
          owner: person,
          createdBy: person,
          attendees: [],
          appointment: null,
          companyName: null,
          note: null,
          recurrenceRule: null,
        };
      },
    },
  };
  const prisma = {
    optionItem: { findUnique: async () => ({ isActive: true }) },
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaClient;
  const service = new ScheduleService(
    prisma,
    { check: async () => ({ ok: true, problems: [], warnings: [] }) } as unknown as SlotGuard,
    { canEditPlan: () => true } as unknown as AccessPolicy,
    {} as SettingsService,
    { notify: async () => undefined } as unknown as NotificationService,
    { record: async () => undefined } as unknown as AuditLogger,
  );
  return { service, created };
}

const base = {
  ownerId: REP,
  type: 'INTERNAL',
  title: '候補日',
  companyName: null,
  allDay: false,
  holidayWork: false,
  note: null,
  attendeeIds: [],
  candidateGroupId: null,
  repeat: null,
};

describe('several candidate dates at once (request 11/12)', () => {
  it('saves every candidate as a tentative plan in one group', async () => {
    const { service, created } = setup();
    const plans = await service.createPlan({ id: REP } as Actor, {
      ...base,
      status: 'TENTATIVE',
      startsAt: '2026-11-16T01:00:00.000Z',
      endsAt: '2026-11-16T02:00:00.000Z',
      candidates: [
        { startsAt: '2026-11-17T04:00:00.000Z', endsAt: '2026-11-17T05:00:00.000Z' },
        { startsAt: '2026-11-18T06:00:00.000Z', endsAt: '2026-11-18T07:00:00.000Z' },
      ],
    });
    expect(plans).toHaveLength(3);
    const groups = new Set(created.map((row) => row.candidateGroupId));
    expect(groups.size).toBe(1);
    expect([...groups][0]).toBeTruthy();
    expect(created.every((row) => row.status === 'TENTATIVE' && row.seriesId === null)).toBe(true);
  });

  it('ignores candidates on a fixed plan', async () => {
    const { service, created } = setup();
    await service.createPlan({ id: REP } as Actor, {
      ...base,
      status: 'FIXED',
      startsAt: '2026-11-16T01:00:00.000Z',
      endsAt: '2026-11-16T02:00:00.000Z',
      candidates: [{ startsAt: '2026-11-17T04:00:00.000Z', endsAt: '2026-11-17T05:00:00.000Z' }],
    });
    expect(created).toHaveLength(1);
    expect(created[0]?.candidateGroupId).toBeNull();
  });
});
