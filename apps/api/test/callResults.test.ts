import { addMonthsToDate, gradeOfResult } from '@telesales/shared';
import { describe, expect, it } from 'vitest';
import type { AccessPolicy, Actor } from '../src/domain/access/AccessPolicy.js';
import type { AuditLogger } from '../src/domain/audit/AuditLogger.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { CallRecordService } from '../src/modules/callRecords/CallRecordService.js';

const actor = { id: 'u1' } as Actor;
const blank = { resultDetail: null, contactName: null, interestLevel: null, notes: null };
const COMPANY = '22222222-2222-4222-8222-222222222222';

function setup() {
  const saved: Record<string, unknown>[] = [];
  const prisma = {
    company: {
      findUnique: async () => ({ id: COMPANY, importRows: [] }),
    },
    callRecord: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        saved.push(data);
        return {
          id: 'r1',
          companyId: COMPANY,
          telemarketerId: 'u1',
          resultDetail: null,
          contactName: null,
          interestLevel: null,
          nextCallDate: null,
          notes: null,
          ...data,
          telemarketer: { id: 'u1', name: 'テレマ' },
          _count: { comments: 0 },
        };
      },
    },
  } as unknown as PrismaClient;
  const policy = { canEditCallRecord: () => true } as unknown as AccessPolicy;
  const audit = { record: async () => undefined } as unknown as AuditLogger;
  // 10/30 10:00 JST
  const clock = { now: () => new Date('2026-10-30T01:00:00Z') };
  return { service: new CallRecordService(prisma, policy, audit, clock), saved };
}

describe('架電結果 (request 10/29)', () => {
  it('saves the detailed result and when a C company comes back on the list', async () => {
    const { service } = setup();
    const dto = await service.create(actor, COMPANY, {
      ...blank,
      grade: 'C',
      resultCode: 'C-01',
      avoidMonths: 6,
    });
    expect(dto).toMatchObject({ resultCode: 'C-01', avoidMonths: 6, avoidUntil: '2027-04-30' });
  });

  it('ignores 「C架電回避目安」 for other grades', async () => {
    const { service, saved } = setup();
    await service.create(actor, COMPANY, {
      ...blank,
      grade: 'B',
      resultCode: 'B-02',
      avoidMonths: 6,
    });
    expect(saved[0]).toMatchObject({ avoidMonths: null, avoidUntil: null });
  });

  it('refuses a result that is not under the chosen grade', async () => {
    const { service } = setup();
    await expect(
      service.create(actor, COMPANY, { ...blank, grade: 'A', resultCode: 'D-02' }),
    ).rejects.toThrow();
  });

  it('adds months to a date, keeping to the end of shorter months', () => {
    expect(addMonthsToDate('2026-10-30', 3)).toBe('2027-01-30');
    expect(addMonthsToDate('2026-08-31', 6)).toBe('2027-02-28');
    expect(addMonthsToDate('2026-10-30', 18)).toBe('2028-04-30');
    expect(gradeOfResult('C-11')).toBe('C');
  });
});
