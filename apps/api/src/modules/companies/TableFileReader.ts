import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { FileUnreadableError } from '../../http/errors/AppError.js';
import { decodeJapaneseText } from '../calendar/HolidayCsvParser.js';
import { fieldForHeader, splitHeaderCell } from './listColumns.js';

export interface TableRow {
  /** Row number as the user sees it in Excel. */
  row: number;
  values: Record<string, string>;
  /** Text written in red, by header (Excel only): the parent company in 「NTT上系」. */
  red?: Record<string, string>;
}

export interface Table {
  headers: string[];
  /** Instructions written under a header name, by header (the Telema template). */
  notes: Record<string, string>;
  /** Row the headers were found on. */
  headerRow: number;
  rows: TableRow[];
}

/** Rows looked at for the headers: the Telema template has a file-name note in row 1. */
const HEADER_SEARCH_ROWS = 10;

/** The first row where at least two cells are known column names; row 1 if none is. */
function findHeaderRow(rows: string[][]): number {
  const index = rows.slice(0, HEADER_SEARCH_ROWS).findIndex(
    (cells) =>
      cells.filter((cell) => {
        const { header, note } = splitHeaderCell(cell);
        return header && fieldForHeader(header, note);
      }).length >= 2,
  );
  return Math.max(index, 0);
}

function headersOf(cells: string[]): { headers: string[]; notes: Record<string, string> } {
  const notes: Record<string, string> = {};
  const headers = cells.map((cell) => {
    const { header, note } = splitHeaderCell(cell);
    if (header && note) notes[header] = note;
    return header;
  });
  return { headers, notes };
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') {
    if ('richText' in value) {
      return value.richText.map((part) => part.text).join('');
    }
    if ('text' in value && typeof value.text === 'string') {
      return value.text;
    }
    if ('hyperlink' in value && typeof value.hyperlink === 'string') {
      return value.hyperlink;
    }
    if ('result' in value) {
      return value.result === undefined || value.result === null ? '' : String(value.result);
    }
    return '';
  }
  return String(value);
}

/** Red-ish font colour (FF0000 and the like), as Excel writes it (ARGB or RGB hex). */
function isRed(color: Partial<ExcelJS.Color> | undefined): boolean {
  const hex = color?.argb?.slice(-6);
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (r ?? 0) >= 0xc0 && (g ?? 255) <= 0x60 && (b ?? 255) <= 0x60;
}

/** The red part of a cell: red runs of rich text, or the whole cell when its font is red. */
function redText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value && typeof value === 'object' && 'richText' in value) {
    return value.richText
      .filter((part) => isRed(part.font?.color))
      .map((part) => part.text)
      .join('')
      .trim();
  }
  return isRed(cell.font?.color) ? cellText(value).trim() : '';
}

/**
 * Reads the first sheet of an .xlsx file or a CSV (UTF-8 or Shift_JIS) into rows keyed by
 * header name, so columns are matched by name and new columns can be added later (spec §9-1).
 */
export async function readTableFile(fileName: string, content: Buffer): Promise<Table> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xlsx')) {
    return readXlsx(content);
  }
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    return readCsv(content);
  }
  throw new FileUnreadableError({ reason: 'unsupported_type' });
}

async function readXlsx(content: Buffer): Promise<Table> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(content as unknown as ArrayBuffer);
  } catch {
    throw new FileUnreadableError({ reason: 'broken_file' });
  }
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 1) {
    throw new FileUnreadableError({ reason: 'empty' });
  }
  const top: string[][] = [];
  for (let number = 1; number <= Math.min(HEADER_SEARCH_ROWS, sheet.rowCount); number++) {
    const cells: string[] = [];
    sheet.getRow(number).eachCell({ includeEmpty: true }, (cell, column) => {
      cells[column - 1] = cellText(cell.value);
    });
    top.push(Array.from(cells, (cell) => cell ?? ''));
  }
  const headerRow = findHeaderRow(top) + 1;
  const { headers, notes } = headersOf(top[headerRow - 1] ?? []);
  const rows: TableRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRow) {
      return;
    }
    const values: Record<string, string> = {};
    const red: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) {
        const cell = row.getCell(index + 1);
        values[header] = cellText(cell.value).trim();
        const marked = redText(cell);
        if (marked) red[header] = marked;
      }
    });
    if (Object.values(values).some(Boolean)) {
      rows.push({ row: rowNumber, values, ...(Object.keys(red).length > 0 ? { red } : {}) });
    }
  });
  return { headers: headers.filter(Boolean), notes, headerRow, rows };
}

function readCsv(content: Buffer): Table {
  let records: string[][];
  try {
    records = parse(decodeJapaneseText(content), {
      relax_column_count: true,
      skip_empty_lines: true,
      bom: true,
    }) as string[][];
  } catch {
    throw new FileUnreadableError({ reason: 'broken_csv' });
  }
  if (records.length === 0) {
    throw new FileUnreadableError({ reason: 'empty' });
  }
  const headerIndex = findHeaderRow(records);
  const { headers, notes } = headersOf(records[headerIndex] ?? []);
  const rows = records.slice(headerIndex + 1).map((record, index) => {
    const values: Record<string, string> = {};
    headers.forEach((header, column) => {
      if (header) {
        values[header] = (record[column] ?? '').trim();
      }
    });
    return { row: headerIndex + index + 2, values };
  });
  return {
    headers: headers.filter(Boolean),
    notes,
    headerRow: headerIndex + 1,
    rows: rows.filter((r) => Object.values(r.values).some(Boolean)),
  };
}
