import { PHONE_DIGITS_PATTERN, phoneDigitsOf } from './companies.js';
import { INDUSTRIES } from './companyValues.js';

/**
 * The checks listcheck (the Telema team's .exe) did, done on import instead (request 10/28 ②):
 * safe fixes are made automatically, what cannot be fixed is shown so it can be corrected on
 * screen or downloaded as CSV. Shared so the screen re-checks a corrected row exactly as the
 * server will.
 */
export type ListRowValues = Partial<Record<string, string>>;

/** Fields the import screen lets a person correct. */
export const EDITABLE_LIST_FIELDS = ['name', 'phone', 'url', 'industry'] as const;
export type EditableListField = (typeof EDITABLE_LIST_FIELDS)[number];

const LEGAL_FORMS: [RegExp, string][] = [
  [/\(株\)/g, '株式会社'],
  [/\(有\)/g, '有限会社'],
  [/\(合\)/g, '合同会社'],
];

const HYPHENS = /[‐‑‒–—―−ーｰ－]/g;

function squeeze(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/** 「(株) 〇〇」 → 「株式会社〇〇」: the template asks for 株式会社 with no space before the name. */
export function fixCompanyName(name: string): string {
  let result = squeeze(name).replace(/\(\s*(株|有|合)\s*\)/g, '($1)');
  for (const [pattern, form] of LEGAL_FORMS) {
    result = result.replace(pattern, form);
  }
  return result.replace(/\s*(株式会社|有限会社|合同会社)\s*/g, '$1').trim();
}

/** Half-width digits and hyphens only: 「０３（１２３４）５６７８」 → 「03-1234-5678」. */
export function fixPhone(phone: string): string {
  return phone
    .normalize('NFKC')
    .replace(HYPHENS, '-')
    .replace(/^\((\d+)\)\s*/, '$1-')
    .replace(/[()\s]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

const FIXERS: Record<string, (value: string) => string> = {
  name: fixCompanyName,
  phone: fixPhone,
  url: (value) => value.normalize('NFKC').trim(),
};

export interface ListRowFix {
  field: string;
  before: string;
  after: string;
}

/** Applies the safe fixes; every other text field is made half-width and trimmed. */
export function cleanListRow(values: ListRowValues): {
  values: ListRowValues;
  fixes: ListRowFix[];
} {
  const result: ListRowValues = {};
  const fixes: ListRowFix[] = [];
  for (const [field, value] of Object.entries(values)) {
    if (value === undefined) continue;
    const after = (FIXERS[field] ?? squeeze)(value);
    if (after) result[field] = after;
    // Only changes a person would notice are listed (not trailing spaces).
    if (after !== value.trim()) fixes.push({ field, before: value, after });
  }
  return { values: result, fixes };
}

/** 「不明」 or no number at all: the row is removed and counted, not shown as an error. */
export function isUnknownPhone(phone: string | undefined): boolean {
  return !phone?.trim() || phone.includes('不明');
}

/** 「-」: the template's way of writing "URL unknown". */
export const UNKNOWN_URL = '-';

export interface ListRowProblem {
  field: EditableListField;
  message: string;
}

export function validateListRow(values: ListRowValues): ListRowProblem[] {
  const problems: ListRowProblem[] = [];
  if (!values.name) {
    problems.push({ field: 'name', message: '会社名が空です' });
  }
  const phone = values.phone ?? '';
  if (!phone) {
    problems.push({ field: 'phone', message: '電話番号が空です' });
  } else if (!/^[\d-]+$/.test(phone)) {
    problems.push({ field: 'phone', message: '電話番号は半角数字と - だけで入力してください' });
  } else if (!PHONE_DIGITS_PATTERN.test(phoneDigitsOf(phone) ?? '')) {
    problems.push({ field: 'phone', message: '電話番号は数字10〜11桁で入力してください' });
  }
  const url = values.url ?? '';
  if (!url) {
    problems.push({ field: 'url', message: 'URLが空です（不明なら - ）' });
  } else if (url !== UNKNOWN_URL && !/^https?:\/\/\S+$/i.test(url)) {
    problems.push({ field: 'url', message: 'URLは http:// か https:// で始めてください' });
  }
  // A blank 業種 is fine; a written one must be on the fixed list (Sano 11/2).
  if (values.industry && !INDUSTRIES.includes(values.industry)) {
    problems.push({ field: 'industry', message: `業種「${values.industry}」は一覧にありません` });
  }
  return problems;
}

/** 「s」: companies in Kyoto, Shiga and Nara, a label only (Sano 10/28 ②). */
export const S_AREA_PREFECTURES: readonly string[] = ['京都府', '滋賀県', '奈良県'];

export function isSArea(prefecture: string | null | undefined): boolean {
  return !!prefecture && S_AREA_PREFECTURES.includes(prefecture);
}

/**
 * The template's 「住所3」 holds the 企業ランク, but an address too long for 住所2 runs on into it:
 * 「ビル3F　上場」 → address part 「ビル3F」, rank 「上場」.
 */
export function splitRankCell(value: string): { addressPart: string; rank: string } {
  const match = /^(.*?)\s*(非上場|上場|優良|中小企業|対象外|上系\s*\S+|上系|\S+上系)$/.exec(
    value.normalize('NFKC').trim(),
  );
  return match
    ? { addressPart: match[1] ?? '', rank: match[2] ?? '' }
    : { addressPart: '', rank: value };
}

/** 「上系島津製作所」 or 「島津製作所上系」 → rank 上系, parent 島津製作所 (Sano 10/28 ③). */
export function splitCompanyRank(rank: string): { rank: string; parentName: string | null } {
  const value = rank.trim();
  const match = /^上系\s*(.+)$/.exec(value) ?? /^(.+?)\s*上系$/.exec(value);
  return match?.[1]
    ? { rank: '上系', parentName: match[1].trim() }
    : { rank: value, parentName: null };
}
