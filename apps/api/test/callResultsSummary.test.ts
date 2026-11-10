import { appointmentRate, Permission } from '@telesales/shared';
import { describe, expect, it } from 'vitest';
import type { Actor } from '../src/domain/access/AccessPolicy.js';
import {
  datesBetween,
  summarizeCallResults,
} from '../src/domain/callResults/summarizeCallResults.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { TelemaService } from '../src/modules/telema/TelemaService.js';

const AOKI = { id: 'u-aoki', name: '青木' };
const BABA = { id: 'u-baba', name: '馬場' };
// 11/10 10:00 JST and 11/11 09:00 JST
const MON = new Date('2026-11-10T01:00:00Z');
const TUE = new Date('2026-11-11T00:00:00Z');

describe('架電実績 (answer 11/10 No.3)', () => {
  it('counts A–D per JST day, leaves E out, and counts every call to the same company', () => {
    const dates = datesBetween('2026-11-10', '2026-11-11');
    const calls = [
      { telemarketerId: AOKI.id, calledAt: MON, grade: 'A' },
      { telemarketerId: AOKI.id, calledAt: MON, grade: 'B' },
      { telemarketerId: AOKI.id, calledAt: MON, grade: 'B' }, // same company again
      { telemarketerId: AOKI.id, calledAt: MON, grade: 'E' },
      { telemarketerId: AOKI.id, calledAt: TUE, grade: 'C' },
      { telemarketerId: BABA.id, calledAt: TUE, grade: 'A' },
      // 11/9 23:30 JST is outside the period
      { telemarketerId: BABA.id, calledAt: new Date('2026-11-09T14:30:00Z'), grade: 'A' },
    ];
    const { rows, totals } = summarizeCallResults(calls, dates, [AOKI], new Map([[BABA.id, BABA]]));
    expect(rows.map((row) => row.telemarketer.name)).toEqual(['青木', '馬場']);
    expect(rows[0]?.days).toEqual([
      { date: '2026-11-10', calls: 3, appointments: 1 },
      { date: '2026-11-11', calls: 1, appointments: 0 },
    ]);
    expect(rows[0]).toMatchObject({ calls: 4, appointments: 1 });
    expect(totals).toEqual([
      { date: '2026-11-10', calls: 3, appointments: 1 },
      { date: '2026-11-11', calls: 2, appointments: 1 },
    ]);
  });

  it('lists telemarketers who did not call with zeros', () => {
    const { rows } = summarizeCallResults([], ['2026-11-10'], [AOKI], new Map());
    expect(rows).toEqual([
      {
        telemarketer: AOKI,
        days: [{ date: '2026-11-10', calls: 0, appointments: 0 }],
        calls: 0,
        appointments: 0,
      },
    ]);
  });

  it('works out the rate as A ÷ (A+B+C+D)', () => {
    expect(appointmentRate(1, 4)).toBe(0.25);
    expect(appointmentRate(0, 0)).toBeNull();
  });

  it('shows a telemarketer only their own row, and refuses more than 62 days', async () => {
    let where: Record<string, unknown> = {};
    const prisma = {
      callRecord: {
        findMany: async (args: { where: Record<string, unknown> }) => {
          where = args.where;
          return [{ telemarketerId: AOKI.id, calledAt: MON, grade: 'A' }];
        },
      },
      user: { findMany: async () => [AOKI] },
    } as unknown as PrismaClient;
    const unused = {} as never;
    const service = new TelemaService(prisma, unused, unused, unused, unused, unused);
    const telemarketer = { id: AOKI.id, can: () => false, hasRole: () => true } as Actor;
    const result = await service.callResults(telemarketer, {
      from: '2026-11-10',
      to: '2026-11-10',
    });
    expect(where).toMatchObject({ telemarketerId: AOKI.id });
    expect(result).toMatchObject({ ownOnly: true, calls: 1, appointments: 1 });
    expect(result.rows.map((row) => row.telemarketer.id)).toEqual([AOKI.id]);

    const lead: Actor = {
      id: 'lead',
      can: (p: Permission) => p === Permission.ConfirmAllocation,
      hasRole: () => true,
    };
    await expect(
      service.callResults(lead, { from: '2026-09-01', to: '2026-11-10' }),
    ).rejects.toThrow();
  });
});
