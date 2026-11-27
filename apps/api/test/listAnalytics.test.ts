import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { ListAnalyticsService } from '../src/modules/companies/ListAnalyticsService.js';

const at = (day: number) => new Date(`2026-11-${String(day).padStart(2, '0')}T01:00:00Z`);

function service() {
  const imports = [
    {
      id: 'L1',
      listName: '20261101_業者A',
      purpose: 'CALL_REQUEST',
      createdAt: at(1),
      rowCount: 3,
    },
    {
      id: 'L2',
      listName: '20261110_業者B',
      purpose: 'CALL_REQUEST',
      createdAt: at(10),
      rowCount: 4,
    },
  ];
  const rows = [
    { listImportId: 'L1', companyId: 'c1', status: 'IMPORTED' },
    { listImportId: 'L1', companyId: 'c2', status: 'IMPORTED' },
    { listImportId: 'L1', companyId: null, status: 'INVALID' },
    { listImportId: 'L2', companyId: 'c3', status: 'IMPORTED' },
    // c1 again, linked (from 11/27 on)
    { listImportId: 'L2', companyId: 'c1', status: 'DUPLICATE' },
    // a flagged copy of c2 counts as c2
    { listImportId: 'L2', companyId: 'copy-c2', status: 'DUPLICATE' },
    { listImportId: 'L2', companyId: null, status: 'NO_PHONE' },
  ];
  const companies = [
    {
      id: 'c1',
      name: '一号商事',
      phone: '06-1111-1111',
      flagMatchId: null,
      phoneDigits: '0611111111',
    },
    {
      id: 'c2',
      name: '二号工業',
      phone: '06-2222-2222',
      flagMatchId: null,
      phoneDigits: '0622222222',
    },
    {
      id: 'c3',
      name: '三号物産',
      phone: '06-3333-3333',
      flagMatchId: null,
      phoneDigits: '0633333333',
    },
    {
      id: 'copy-c2',
      name: '二号工業',
      phone: '06-2222-2222',
      flagMatchId: 'c2',
      phoneDigits: '0622222222',
    },
  ];
  const prisma = {
    listImport: { findMany: async () => imports },
    listImportRow: {
      findMany: async ({ where }: { where: { status?: string } }) =>
        where.status === 'DUPLICATE' ? [] : rows,
    },
    company: {
      findMany: async ({ where }: { where: { id?: { in: string[] } } }) =>
        where.id ? companies.filter((c) => where.id?.in.includes(c.id)) : [],
    },
    appointment: {
      findMany: async () => [{ companyId: 'c1', createdAt: at(12) }],
    },
  } as unknown as PrismaClient;
  return new ListAnalyticsService(prisma);
}

describe('リスト分析 (request 11/27)', () => {
  it('counts each list and finds the companies that came on more than one', async () => {
    const result = await service().analyse();
    expect(result.totals).toEqual({
      lists: 2,
      rows: 7,
      created: 3,
      duplicates: 2,
      problems: 1,
      repeatedCompanies: 2,
    });
    const [newest, oldest] = result.lists;
    expect(newest).toMatchObject({
      id: 'L2',
      created: 1,
      duplicates: 2,
      noPhone: 1,
      appointments: 1,
    });
    expect(newest?.overlaps).toEqual([
      { listImportId: 'L1', listName: '20261101_業者A', shared: 2 },
    ]);
    expect(oldest).toMatchObject({ id: 'L1', problems: 1, overlaps: [] });
    expect(result.repeated.map((r) => [r.company.name, r.lists.map((l) => l.listName)])).toEqual([
      ['一号商事', ['20261101_業者A', '20261110_業者B']],
      ['二号工業', ['20261101_業者A', '20261110_業者B']],
    ]);
  });
});
