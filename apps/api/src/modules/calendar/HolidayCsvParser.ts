import iconv from 'iconv-lite';

export interface ParsedHoliday {
  date: string;
  name: string;
}

/**
 * Parses the Cabinet Office "国民の祝日" CSV (Shift_JIS; columns: 国民の祝日・休日月日, 国民の祝日・休日名称).
 * Dates look like 2026/1/1.
 */
export function parseHolidayCsv(content: Buffer): ParsedHoliday[] {
  const text = decodeJapaneseText(content);
  const result: ParsedHoliday[] = [];
  for (const line of text.split(/\r?\n/)) {
    const [rawDate, rawName] = line.split(',');
    const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(rawDate?.trim() ?? '');
    if (!match || !rawName) {
      continue;
    }
    const [, year, month = '', day = ''] = match;
    const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    result.push({ date, name: rawName.trim() });
  }
  return result;
}

/** UTF-8 (with or without BOM) or Shift_JIS/CP932, detected from the bytes. */
export function decodeJapaneseText(content: Buffer): string {
  const utf8 = content.toString('utf8');
  if (!utf8.includes('�')) {
    return utf8.replace(/^﻿/, '');
  }
  return iconv.decode(content, 'cp932');
}
