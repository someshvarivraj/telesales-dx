import { parse } from 'csv-parse/sync';
import { decodeJapaneseText } from '../calendar/HolidayCsvParser.js';

/** One row of the telemarketing-system CSV export (spec §9-2; CP932, 14 columns). */
export interface TelemaCsvRow {
  telemaIdNo: string;
  industry: string;
  name: string;
  office: string;
  department: string;
  phone: string;
  address: string;
  nearestStation: string;
  latestResult: string;
  latestResultDetail: string;
  latestCallDate: string;
  callCount: string;
  telemarketer: string;
  listName: string;
}

const CSV_COLUMNS: Record<keyof TelemaCsvRow, string> = {
  telemaIdNo: 'テレマIDNo.',
  industry: '業種',
  name: '会社名',
  office: '事業所名',
  department: '部署名',
  phone: '電話番号',
  address: '住所',
  nearestStation: '最寄駅',
  latestResult: '最新テレマ結果',
  latestResultDetail: '最新テレマ結果詳細',
  latestCallDate: '最新テレマ日',
  callCount: '回数',
  telemarketer: 'テレマ担当者',
  listName: 'リスト名',
};

export class HandoverFileError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'HandoverFileError';
  }
}

function normalizeHeader(value: string): string {
  return value.normalize('NFKC').replace(/^﻿/, '').replace(/\s/g, '');
}

/** Columns are matched by header name, so a reordered export still reads correctly. */
export function parseTelemaCsv(content: Buffer): TelemaCsvRow[] {
  let records: string[][];
  try {
    records = parse(decodeJapaneseText(content), {
      relax_column_count: true,
      skip_empty_lines: true,
      bom: true,
    }) as string[][];
  } catch {
    throw new HandoverFileError('broken_csv');
  }
  const [header, ...rows] = records;
  if (!header) {
    throw new HandoverFileError('empty');
  }
  const index = new Map(header.map((name, position) => [normalizeHeader(name), position]));
  const position = (key: keyof TelemaCsvRow) => index.get(normalizeHeader(CSV_COLUMNS[key]));
  if (position('name') === undefined || position('phone') === undefined) {
    throw new HandoverFileError('not_telema_csv');
  }
  return rows
    .map((row) => {
      const result = {} as TelemaCsvRow;
      for (const key of Object.keys(CSV_COLUMNS) as (keyof TelemaCsvRow)[]) {
        const column = position(key);
        result[key] = column === undefined ? '' : (row[column] ?? '').trim();
      }
      return result;
    })
    .filter((row) => row.name);
}

/** Fields of the CubePDF handover sheet 「営業さんへの伝達事項」 (one page = one appointment). */
export interface HandoverPdfFields {
  salesRep: string;
  telemarketer: string;
  company: string;
  callDate: string;
  clientNo: string;
  department: string;
  contact: string;
  phone: string;
  nearestStation: string;
  address: string;
  visitDateTime: string;
  desiredJobType: string;
  notes: string;
  pageCount: number;
}

interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
}

/**
 * Labels on the sheet in reading order. 「担当者」 appears twice: the upper one is the
 * telemarketer, the lower one the customer contact.
 */
const LABELS = [
  ['営業担当', 'salesRep'],
  ['会社名', 'company'],
  ['担当者', 'telemarketer'],
  ['テレマ日', 'callDate'],
  ['クライアント番号', 'clientNo'],
  ['部署名', 'department'],
  ['担当者', 'contact'],
  ['電話番号', 'phone'],
  ['最寄り駅', 'nearestStation'],
  ['住所', 'address'],
  ['訪問日時', 'visitDateTime'],
  ['希望職種', 'desiredJobType'],
  ['連絡事項', 'notes'],
] as const;

type LabelField = (typeof LABELS)[number][1];

const SAME_LINE = 4;

function joinLine(items: TextItem[]): string {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let text = '';
  let lastEnd: number | null = null;
  for (const item of sorted) {
    if (lastEnd !== null && item.x - lastEnd > 3) {
      text += ' ';
    }
    text += item.text;
    lastEnd = item.x + item.width;
  }
  return text.trim();
}

function joinLines(items: TextItem[]): string {
  const lines: TextItem[][] = [];
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines.find(
      (candidate) => candidate[0] && Math.abs(candidate[0].y - item.y) < SAME_LINE,
    );
    if (line) {
      line.push(item);
    } else {
      lines.push([item]);
    }
  }
  return lines.map(joinLine).join('\n').trim();
}

/**
 * Reads the label → value layout by position: a value is to the right of its label, above
 * the next label in the same column and left of the next label in the same rows.
 */
export function readHandoverLayout(items: TextItem[]): Omit<HandoverPdfFields, 'pageCount'> {
  const remaining = items.filter((item) => item.text.trim());
  const labelItems: { field: LabelField; item: TextItem }[] = [];
  const used = new Set<TextItem>();
  const ordered = [...remaining].sort((a, b) => b.y - a.y || a.x - b.x);
  for (const [label, field] of LABELS) {
    const item = ordered.find(
      (candidate) => !used.has(candidate) && candidate.text.trim() === label,
    );
    if (item) {
      used.add(item);
      labelItems.push({ field, item });
    }
  }
  if (labelItems.length < 6) {
    throw new HandoverFileError('not_handover_pdf');
  }
  const labels = labelItems.map((entry) => entry.item);
  const values = remaining.filter(
    (item) => !used.has(item) && item.text.trim() !== '営業さんへの伝達事項',
  );

  const result = {} as Omit<HandoverPdfFields, 'pageCount'>;
  for (const { field, item: label } of labelItems) {
    const below = labels
      .filter(
        (other) =>
          other !== label && Math.abs(other.x - label.x) < 10 && other.y < label.y - SAME_LINE,
      )
      .sort((a, b) => b.y - a.y)[0];
    const top = label.y + SAME_LINE + 2;
    const bottom = field === 'notes' ? -Infinity : below ? below.y + SAME_LINE + 2 : label.y - 14;
    const left = label.x + label.width;
    const right = labels
      .filter((other) => other.x > label.x + label.width && other.y <= top && other.y > bottom)
      .reduce((min, other) => Math.min(min, other.x), Infinity);
    const inside = values.filter(
      (item) => item.x >= left - 1 && item.x < right && item.y <= top && item.y > bottom,
    );
    result[field] = field === 'notes' ? joinLines(inside) : joinLines(inside).replace(/\n/g, ' ');
  }
  for (const [, field] of LABELS) {
    result[field] ??= '';
  }
  return result;
}

export async function parseHandoverPdf(content: Buffer): Promise<HandoverPdfFields> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  let document;
  try {
    document = await getDocument({ data: new Uint8Array(content), useSystemFonts: true }).promise;
  } catch {
    throw new HandoverFileError('broken_pdf');
  }
  try {
    const page = await document.getPage(1);
    const textContent = await page.getTextContent();
    const items: TextItem[] = [];
    for (const item of textContent.items) {
      if ('str' in item && item.str.trim()) {
        items.push({
          text: item.str,
          x: item.transform[4] as number,
          y: item.transform[5] as number,
          width: item.width,
        });
      }
    }
    if (items.length === 0) {
      // An image-only PDF would need OCR; the spec says the sheet always has text.
      throw new HandoverFileError('no_text');
    }
    return { ...readHandoverLayout(items), pageCount: document.numPages };
  } finally {
    await document.cleanup();
  }
}

/** 「2026/10/14 15:00」 → { date: '2026-10-14', time: '15:00' } */
export function parseSlashDateTime(value: string): { date: string; time: string | null } | null {
  const match = /(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/.exec(
    value.normalize('NFKC'),
  );
  if (!match) {
    return null;
  }
  const [, year, month = '', day = '', hour, minute] = match;
  const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const time = hour ? `${hour.padStart(2, '0')}:${minute}` : null;
  return { date, time };
}

/** Online when the notes mention オンライン / Teams / ZOOM / Web (spec §9-2). */
export function suggestsOnline(text: string): boolean {
  return /オンライン|teams|zoom|web|ウェブ/i.test(text.normalize('NFKC'));
}
