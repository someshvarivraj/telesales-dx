import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { FileUnreadableError } from '../../http/errors/AppError.js';
import { decodeJapaneseText } from '../calendar/HolidayCsvParser.js';

export interface TableRow {
  /** Row number as the user sees it in Excel (header = 1). */
  row: number;
  values: Record<string, string>;
  /** Text written in red, by header (Excel only): the parent company in 「NTT上系」. */
  red?: Record<string, string>;
}

export interface Table {
  headers: string[];
  rows: TableRow[];
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

function normalizeHeader(header: string): string {
  return header.normalize('NFKC').replace(/^﻿/, '').trim();
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
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, column) => {
    headers[column - 1] = normalizeHeader(cellText(cell.value));
  });
  const rows: TableRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
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
  return { headers: headers.filter(Boolean), rows };
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
  const [headerRecord, ...dataRecords] = records;
  if (!headerRecord) {
    throw new FileUnreadableError({ reason: 'empty' });
  }
  const headers = headerRecord.map(normalizeHeader);
  const rows = dataRecords.map((record, index) => {
    const values: Record<string, string> = {};
    headers.forEach((header, column) => {
      if (header) {
        values[header] = (record[column] ?? '').trim();
      }
    });
    return { row: index + 2, values };
  });
  return {
    headers: headers.filter(Boolean),
    rows: rows.filter((r) => Object.values(r.values).some(Boolean)),
  };
}
