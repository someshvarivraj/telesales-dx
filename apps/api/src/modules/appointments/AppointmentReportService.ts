import {
  addDays,
  AppointmentStatus,
  fromJst,
  jstDate,
  MeetingFormat,
  OptionCategory,
} from '@telesales/shared';
import ExcelJS from 'exceljs';
import type { Clock } from '../../domain/Clock.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { ValidationError } from '../../http/errors/AppError.js';
import type { OptionService } from '../options/OptionService.js';
import { familyName } from './AppointmentMailTemplates.js';

const JST_OFFSET_MS = 9 * 60 * 60_000;

/** Excel has no time zones: write the JST wall-clock time. */
function excelDate(instant: Date): Date {
  return new Date(instant.getTime() + JST_OFFSET_MS);
}

function shortRange(from: string, to: string): string {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const start = `${fy}/${fm}/${fd}`;
  return fy === ty ? `${start}～${tm}/${td}` : `${start}～${ty}/${tm}/${td}`;
}

const HEADERS = [
  'No',
  'アポ取得日',
  '取引区分',
  '新規アポ',
  'ｸﾗｲｱﾝﾄNo',
  '企業名',
  '部署',
  '担当者',
  '訪問形態',
  'アポ取得者',
  '訪問日時',
  '訪問者',
  '入力',
] as const;

/** Column widths of today's report (営業訪問表). */
const WIDTHS = [6, 13.5, 9, 9.25, 9.9, 53.5, 12.1, 12.25, 8.25, 9, 19.75, 8, 60];

export interface ReportFile {
  fileName: string;
  content: Buffer;
  count: number;
}

/**
 * The report Excel (spec §6, §12): the list plus summary counts on top, in the layout of
 * 「報告用Excel（営業訪問表）」. Used for the date-range download and the daily N19 mail.
 * Cancelled appointments are left out, so a re-booking is counted once.
 */
export class AppointmentReportService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly options: OptionService,
    private readonly clock: Clock,
  ) {}

  async build(
    bookedFrom: string,
    bookedTo: string,
    filter: { bookedById?: string } = {},
  ): Promise<ReportFile> {
    if (bookedTo < bookedFrom || addDays(bookedFrom, 400) < bookedTo) {
      throw new ValidationError({ bookedTo: ['invalid_range'] });
    }
    const [rows, customerTypes, booker] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          bookedAt: { gte: fromJst(bookedFrom), lt: fromJst(addDays(bookedTo, 1)) },
          status: { not: AppointmentStatus.Cancelled },
          ...(filter.bookedById ? { bookedById: filter.bookedById } : {}),
        },
        include: {
          company: { select: { name: true, clientNo: true } },
          bookedBy: { select: { name: true } },
          salesRep: { select: { name: true } },
        },
        orderBy: [{ bookedAt: 'asc' }, { startsAt: 'asc' }],
      }),
      this.options.labels(OptionCategory.CustomerType),
      filter.bookedById
        ? this.prisma.user.findUnique({ where: { id: filter.bookedById }, select: { name: true } })
        : Promise.resolve(null),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'テレマ・営業DX';
    const now = this.clock.now();
    const sheetName =
      jstDate(now).replaceAll('-', '') +
      new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(11, 19).replaceAll(':', '');
    const sheet = workbook.addWorksheet(sheetName);
    WIDTHS.forEach((width, index) => {
      sheet.getColumn(index + 1).width = width;
    });

    const visits = rows.filter((row) => row.format === MeetingFormat.Visit).length;
    const web = rows.length - visits;
    const newCount = rows.filter((row) => row.isNewAppointment).length;
    const perList = new Map<string, number>();
    for (const row of rows) {
      const name = row.listName ?? '（リスト名なし）';
      perList.set(name, (perList.get(name) ?? 0) + 1);
    }
    const listParts = [...perList.entries()].map(([name, count]) => `${name}：${count}`);
    const listLines = [listParts.slice(0, 4), listParts.slice(4, 8), listParts.slice(8)].map(
      (part) => part.join('　'),
    );

    sheet.getCell('A1').value = 'アポ取得一覧';
    sheet.getCell('E1').value = '【テレマ】';
    sheet.getCell('F1').value = `訪問：${visits}　WEB：${web}　合計：${rows.length}`;
    sheet.getCell('A2').value = booker ? `（${booker.name}）` : '（全員）';
    sheet.getCell('B2').value = shortRange(bookedFrom, bookedTo);
    sheet.getCell('F2').value = `新規：${newCount}`;
    listLines.forEach((line, index) => {
      if (line) {
        sheet.getCell(`M${index + 1}`).value = line;
      }
    });

    const header = sheet.getRow(4);
    HEADERS.forEach((title, index) => {
      const cell = header.getCell(index + 1);
      cell.value = title;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F1F0' } };
      cell.border = { bottom: { style: 'thin' } };
    });

    rows.forEach((row, index) => {
      const excelRow = sheet.getRow(5 + index);
      excelRow.values = [
        index + 1,
        excelDate(fromJst(jstDate(row.bookedAt))),
        row.customerType ? (customerTypes.get(row.customerType) ?? row.customerType) : '',
        row.isNewAppointment ? '●' : '',
        row.company.clientNo && /^\d+$/.test(row.company.clientNo)
          ? Number(row.company.clientNo)
          : (row.company.clientNo ?? ''),
        row.company.name,
        row.contactDepartment ?? '',
        row.contactName ?? '',
        row.format === MeetingFormat.Visit ? '訪問' : 'Web',
        familyName(row.bookedBy.name),
        excelDate(row.startsAt),
        familyName(row.salesRep.name),
        row.listName ?? '',
      ];
      excelRow.getCell(2).numFmt = 'yyyy/m/d';
      excelRow.getCell(11).numFmt = 'yyyy/m/d h:mm';
      excelRow.getCell(4).alignment = { horizontal: 'center' };
    });
    sheet.views = [{ state: 'frozen', ySplit: 4 }];

    const content = Buffer.from(await workbook.xlsx.writeBuffer());
    const range =
      bookedFrom === bookedTo
        ? bookedFrom.replaceAll('-', '')
        : `${bookedFrom.replaceAll('-', '')}-${bookedTo.replaceAll('-', '')}`;
    return { fileName: `アポ取得一覧_${range}.xlsx`, content, count: rows.length };
  }
}
