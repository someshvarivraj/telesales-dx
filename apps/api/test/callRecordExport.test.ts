import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { CallRecordExportService } from '../src/modules/callRecords/CallRecordExportService.js';
import type { OptionService } from '../src/modules/options/OptionService.js';

// Made-up call; the notes hold a formula-looking value that must stay text.
const call = {
  calledAt: new Date('2026-10-23T01:30:00Z'),
  grade: 'A',
  resultDetail: '前向きに検討',
  contactName: '山田',
  interestLevel: 'HIGH',
  nextCallDate: new Date('2026-10-30T00:00:00Z'),
  notes: '=1+1',
  telemarketer: { name: 'テレマ 一号' },
  company: {
    name: 'テスト物産株式会社',
    office: '本社',
    department: '営業部',
    phone: '06-6000-0001',
    industry: '卸売業',
    prefecture: '大阪府',
    address: '大阪府大阪市中央区',
    url: 'https://www.example.co.jp',
    customerType: 'NEW',
    listName: '見本リスト',
  },
};

function service(rows: unknown[], where: unknown[]) {
  const prisma = {
    callRecord: {
      findMany: (args: { where: unknown }) => {
        where.push(args.where);
        return Promise.resolve(rows);
      },
    },
  } as unknown as PrismaClient;
  const options = {
    labels: (category: string) =>
      Promise.resolve(
        new Map(
          category === 'call_grade'
            ? [['A', 'A（アポ）']]
            : category === 'interest_level'
              ? [['HIGH', '高い']]
              : [['NEW', '新規']],
        ),
      ),
  } as unknown as OptionService;
  return new CallRecordExportService(prisma, options, {
    now: () => new Date('2026-10-24T03:00:00Z'),
  });
}

describe('CallRecordExportService', () => {
  it('writes one row per call with labels, JST time and formulas kept as text', async () => {
    const where: unknown[] = [];
    const file = await service([call], where).build({
      from: '2026-10-23',
      to: '2026-10-23',
      listName: '見本リスト',
    });
    expect(file.fileName).toBe('架電結果_2026-10-23_2026-10-23_20261024.xlsx');
    expect(where[0]).toMatchObject({ company: { listName: '見本リスト' } });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.content);
    const sheet = workbook.getWorksheet('架電結果');
    expect(sheet?.getRow(1).getCell(1).value).toBe('架電日時');
    const row = sheet?.getRow(2);
    // 01:30 UTC = 10:30 JST, written as wall-clock time.
    expect((row?.getCell(1).value as Date).toISOString()).toBe('2026-10-23T10:30:00.000Z');
    expect(row?.getCell(3).value).toBe('A（アポ）');
    expect(row?.getCell(6).value).toBe('高い');
    expect(row?.getCell(8).value).toBe('=1+1');
    expect(row?.getCell(8).formula).toBeUndefined();
    expect(row?.getCell(17).value).toBe('新規');
  });

  it('refuses a reversed or over-long period', async () => {
    await expect(service([], []).build({ from: '2026-10-24', to: '2026-10-23' })).rejects.toThrow();
    await expect(service([], []).build({ from: '2025-01-01', to: '2026-10-23' })).rejects.toThrow();
  });
});
