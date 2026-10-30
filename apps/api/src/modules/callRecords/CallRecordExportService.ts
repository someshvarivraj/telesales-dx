import { addDays, fromJst, jstDate, OptionCategory } from '@telesales/shared';
import ExcelJS from 'exceljs';
import type { Clock } from '../../domain/Clock.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { ValidationError } from '../../http/errors/AppError.js';
import type { OptionService } from '../options/OptionService.js';

const JST_OFFSET_MS = 9 * 60 * 60_000;

/** Excel has no time zones: write the JST wall-clock time. */
function excelDate(instant: Date): Date {
  return new Date(instant.getTime() + JST_OFFSET_MS);
}

const COLUMNS: { header: string; width: number }[] = [
  { header: '架電日時', width: 17 },
  { header: 'テレマ担当', width: 14 },
  { header: '判定', width: 8 },
  { header: '架電結果', width: 24 },
  { header: '結果の詳細', width: 40 },
  { header: '先方担当者', width: 14 },
  { header: '興味度', width: 10 },
  { header: 'B次回架電日', width: 12 },
  { header: 'C架電回避目安', width: 12 },
  { header: 'メモ', width: 30 },
  { header: '会社名', width: 28 },
  { header: '事業所名', width: 14 },
  { header: '部署名', width: 14 },
  { header: '電話番号', width: 15 },
  { header: '業種', width: 14 },
  { header: '都道府県', width: 10 },
  { header: '住所', width: 34 },
  { header: 'URL', width: 28 },
  { header: '取引区分', width: 10 },
  { header: 'リスト名', width: 20 },
];

export interface CallRecordExportFilter {
  from: string;
  to: string;
  telemarketerId?: string;
  listName?: string;
}

/**
 * 架電結果をExcelで書き出す (Sano 10/24 No.7, in place of importing old-system results):
 * one row per call in the period, with the company it was made to. Values are written
 * as plain cells, so text like 「=1+1」 stays text and is never run as a formula.
 */
export class CallRecordExportService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly options: OptionService,
    private readonly clock: Clock,
  ) {}

  async build(filter: CallRecordExportFilter): Promise<{ fileName: string; content: Buffer }> {
    if (filter.to < filter.from || addDays(filter.from, 400) < filter.to) {
      throw new ValidationError({ to: ['invalid_range'] });
    }
    const [rows, grades, interests, customerTypes, results] = await Promise.all([
      this.prisma.callRecord.findMany({
        where: {
          calledAt: { gte: fromJst(filter.from), lt: fromJst(addDays(filter.to, 1)) },
          ...(filter.telemarketerId ? { telemarketerId: filter.telemarketerId } : {}),
          ...(filter.listName ? { company: { listName: filter.listName } } : {}),
        },
        include: {
          telemarketer: { select: { name: true } },
          company: {
            select: {
              name: true,
              office: true,
              department: true,
              phone: true,
              industry: true,
              prefecture: true,
              address: true,
              url: true,
              customerType: true,
              listName: true,
            },
          },
        },
        orderBy: { calledAt: 'asc' },
      }),
      this.options.labels(OptionCategory.CallGrade),
      this.options.labels(OptionCategory.InterestLevel),
      this.options.labels(OptionCategory.CustomerType),
      this.options.labels(OptionCategory.CallResult),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'テレマ・営業DX';
    const sheet = workbook.addWorksheet('架電結果');
    sheet.columns = COLUMNS.map((column) => ({ header: column.header, width: column.width }));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    const label = (labels: Map<string, string>, code: string | null) =>
      code ? (labels.get(code) ?? code) : '';
    for (const row of rows) {
      sheet.addRow([
        excelDate(row.calledAt),
        row.telemarketer.name,
        label(grades, row.grade),
        label(results, row.resultCode),
        row.resultDetail ?? '',
        row.contactName ?? '',
        label(interests, row.interestLevel),
        row.nextCallDate ? row.nextCallDate.toISOString().slice(0, 10) : '',
        row.avoidUntil ? `${row.avoidUntil.toISOString().slice(0, 10)}まで` : '',
        row.notes ?? '',
        row.company.name,
        row.company.office ?? '',
        row.company.department ?? '',
        row.company.phone ?? '',
        row.company.industry ?? '',
        row.company.prefecture ?? '',
        row.company.address ?? '',
        row.company.url ?? '',
        label(customerTypes, row.company.customerType),
        row.company.listName ?? '',
      ]);
    }
    sheet.getColumn(1).numFmt = 'yyyy/mm/dd hh:mm';
    sheet.autoFilter = { from: 'A1', to: { row: 1, column: COLUMNS.length } };

    const stamp = jstDate(this.clock.now()).replaceAll('-', '');
    const content = Buffer.from(await workbook.xlsx.writeBuffer());
    return { fileName: `架電結果_${filter.from}_${filter.to}_${stamp}.xlsx`, content };
  }
}
