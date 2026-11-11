import { bulkEditRequestSchema, MAX_PICKED_COMPANIES, officeKindOf } from '@telesales/shared';
import { describe, expect, it } from 'vitest';
import type { AccessPolicy, Actor } from '../src/domain/access/AccessPolicy.js';
import { countByKind, dealByOffice } from '../src/domain/allocation/dealByOffice.js';
import type { AuditLogger } from '../src/domain/audit/AuditLogger.js';
import type { CalendarRepository } from '../src/domain/calendar/CalendarRepository.js';
import type { Clock } from '../src/domain/Clock.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { ForbiddenError, ValidationError } from '../src/http/errors/AppError.js';
import { AllocationService } from '../src/modules/telema/AllocationService.js';
import type { NotificationService } from '../src/modules/notifications/NotificationService.js';
import type { TelemaService } from '../src/modules/telema/TelemaService.js';

const offices = (...names: (string | null)[]) =>
  names.map((office, index) => ({ id: `c${index}`, office }));

describe('officeKindOf', () => {
  it('reads 本社・支社・工場・その他 from 事業所名', () => {
    expect(officeKindOf('本社')).toBe('HEAD');
    expect(officeKindOf('東京本店')).toBe('HEAD');
    expect(officeKindOf('大阪支店')).toBe('BRANCH');
    expect(officeKindOf('名古屋営業所')).toBe('BRANCH');
    expect(officeKindOf('第二工場')).toBe('FACTORY');
    expect(officeKindOf('研究所')).toBe('OTHER');
    expect(officeKindOf(null)).toBe('OTHER');
  });
});

describe('dealByOffice (answer 11/10 No.5 ②)', () => {
  it('spreads each kind of office evenly', () => {
    const items = offices('本社', '本社', '本社', '本社', '工場', '工場', '支店', null);
    const assignment = dealByOffice(items, ['a', 'b']);
    expect(countByKind(items, assignment, 'a')).toEqual({
      HEAD: 2,
      BRANCH: 1,
      FACTORY: 1,
      OTHER: 0,
    });
    expect(countByKind(items, assignment, 'b')).toEqual({
      HEAD: 2,
      BRANCH: 0,
      FACTORY: 1,
      OTHER: 1,
    });
  });

  it('keeps the totals even when the kinds do not split evenly', () => {
    const items = offices('本社', '支店', '工場', null, '本社', '支店', '工場');
    const assignment = dealByOffice(items, ['a', 'b', 'c']);
    const totals = ['a', 'b', 'c'].map(
      (id) => [...assignment.values()].filter((userId) => userId === id).length,
    );
    expect(totals.sort()).toEqual([2, 2, 3]);
    expect(assignment.size).toBe(items.length);
  });

  it('gives everything to the only person', () => {
    const items = offices('本社', '工場');
    expect([...dealByOffice(items, ['a']).values()]).toEqual(['a', 'a']);
  });
});

describe('一括修正 of a whole search (answer 11/10 No.12, No.13)', () => {
  it('takes every company a search can pick, and 備考 too', () => {
    const ids = Array.from(
      { length: MAX_PICKED_COMPANIES },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );
    expect(
      bulkEditRequestSchema.safeParse({ companyIds: ids, changes: { telemaMemo: '再架電' } })
        .success,
    ).toBe(true);
    expect(
      bulkEditRequestSchema.safeParse({
        companyIds: [...ids, '00000000-0000-4000-8000-999999999999'],
        changes: { industry: '製造業' },
      }).success,
    ).toBe(false);
  });
});

const LEAD = { id: 'lead' } as Actor;
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function setup({ manages = true, existing = 1 } = {}) {
  const written: { created?: unknown[]; deleted?: unknown; reopened?: boolean } = {};
  let calculated = false;
  const prisma = {
    allocation: {
      count: async () => existing,
      deleteMany: (args: unknown) => {
        written.deleted = args;
        return args;
      },
      createMany: ({ data }: { data: unknown[] }) => {
        written.created = data;
        return data;
      },
      updateMany: () => {
        written.reopened = true;
        return {};
      },
    },
    company: {
      // c2 is 架電対象外 or 重複: the query leaves it out.
      findMany: async () => [
        { id: 'c3', office: '工場' },
        { id: 'c1', office: '本社' },
      ],
    },
    shift: {
      findMany: async () => [
        { userId: A, workingMinutes: 420 },
        { userId: B, workingMinutes: 420 },
      ],
    },
    $transaction: async (steps: unknown[]) => steps,
  } as unknown as PrismaClient;
  const team = {
    telemarketers: async () =>
      [A, B].map((id) => ({
        user: { id, name: id === A ? '山田' : '佐藤' },
        isAllocationTarget: true,
        territory: [],
      })),
  } as unknown as TelemaService;
  const calendar = {
    load: async () => ({ isBusinessDay: () => true }),
  } as unknown as CalendarRepository;
  const service = new AllocationService(
    prisma,
    { managesTelema: () => manages } as unknown as AccessPolicy,
    team,
    calendar,
    {} as NotificationService,
    { record: async () => undefined } as unknown as AuditLogger,
    { now: () => new Date('2026-11-10T01:00:00Z') } as Clock,
  );
  service.calculate = async () => {
    calculated = true;
    return { calls: 0, dayBefore: 0 };
  };
  return { service, written, wasCalculated: () => calculated };
}

describe('AllocationService.assign', () => {
  it('adds the companies to the day as a draft, in the search order', async () => {
    const { service, written, wasCalculated } = setup();
    const result = await service.assign(LEAD, '2026-11-10', ['c1', 'c2', 'c3'], [A, B]);
    expect(result.assigned).toBe(2);
    expect(result.skipped).toBe(1);
    expect(written.created).toEqual([
      expect.objectContaining({ companyId: 'c1', assigneeId: A, kind: 'CALL' }),
      expect.objectContaining({ companyId: 'c3', assigneeId: B, kind: 'CALL' }),
    ]);
    expect(written.reopened).toBe(true);
    expect(wasCalculated()).toBe(false);
    expect(result.people.find((p) => p.user.id === A)?.byKind).toEqual({
      HEAD: 1,
      BRANCH: 0,
      FACTORY: 0,
      OTHER: 0,
    });
  });

  it('makes the automatic part first when the day has none yet', async () => {
    const { service, wasCalculated } = setup({ existing: 0 });
    await service.assign(LEAD, '2026-11-10', ['c1'], [A]);
    expect(wasCalculated()).toBe(true);
  });

  it('refuses people who are not working, past days and non-leads', async () => {
    await expect(
      setup().service.assign(LEAD, '2026-11-10', ['c1'], ['cccccccc-cccc-4ccc-8ccc-cccccccccccc']),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(setup().service.assign(LEAD, '2026-11-09', ['c1'], [A])).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      setup({ manages: false }).service.assign(LEAD, '2026-11-10', ['c1'], [A]),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
