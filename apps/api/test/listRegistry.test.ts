import { datedListName } from '@telesales/shared';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { AuditLogger } from '../src/domain/audit/AuditLogger.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { FileService } from '../src/modules/files/FileService.js';
import { ListImportService } from '../src/modules/companies/ListImportService.js';
import type { NotificationService } from '../src/modules/notifications/NotificationService.js';
import type { OptionService } from '../src/modules/options/OptionService.js';

describe('リスト取り込み (request 10/29)', () => {
  it('puts the import date in front of the list name, once', () => {
    expect(datedListName(' 大阪製造業 ', '2026-10-30')).toBe('20261030_大阪製造業');
    expect(datedListName('20261030_大阪製造業', '2026-10-30')).toBe('20261030_大阪製造業');
  });

  it('writes 登録済リスト一覧 with counts, appointment companies and the file link', async () => {
    const importedAt = new Date('2026-10-20T01:00:00Z');
    const prisma = {
      listImport: {
        findMany: async () => [
          {
            id: 'L1',
            createdAt: importedAt,
            listName: '20261020_大阪製造業',
            purpose: 'CALL_REQUEST',
            autoAllocate: false,
            rowCount: 4,
            duplicateCount: 1,
            checkCount: 0,
            errorCount: 1,
            importedBy: { id: 'u1', name: 'リーダー' },
            file: { originalName: '大阪製造業.xlsx' },
            rows: [
              { companyId: 'c1', status: 'IMPORTED' },
              { companyId: 'c2', status: 'IMPORTED' },
              { companyId: 'c3', status: 'DUPLICATE' },
            ],
          },
        ],
      },
      appointment: {
        findMany: async () => [
          {
            companyId: 'c1',
            createdAt: new Date('2026-10-25T01:00:00Z'),
            company: { name: 'テスト工業' },
          },
          // Booked before this list came in: not from this list.
          {
            companyId: 'c2',
            createdAt: new Date('2026-10-01T01:00:00Z'),
            company: { name: '前からの会社' },
          },
        ],
      },
    } as unknown as PrismaClient;
    const service = new ListImportService(
      prisma,
      {} as FileService,
      {} as OptionService,
      {} as NotificationService,
      {} as AuditLogger,
    );
    const file = await service.registryWorkbook('https://app.example');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.content as unknown as ExcelJS.Buffer);
    const row = workbook.getWorksheet('登録済リスト一覧')?.getRow(2);
    expect(row?.getCell(2).value).toBe('20261020_大阪製造業');
    expect(row?.getCell(4).value).toBe('しない');
    expect(row?.getCell(5).value).toBe(4);
    expect(row?.getCell(6).value).toBe(2);
    expect(row?.getCell(10).value).toBe(1);
    expect(row?.getCell(11).value).toBe('テスト工業');
    expect(row?.getCell(13).value).toMatchObject({
      text: '大阪製造業.xlsx',
      hyperlink: 'https://app.example/api/list-imports/L1/file',
    });
  });
});
