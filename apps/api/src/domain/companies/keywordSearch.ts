import type { Prisma } from '../../generated/prisma/client.js';
import { normalizeCompanyName } from './duplicates.js';

/** Words of a keyword box: full- or half-width spaces split them; at most 8 words. */
export function keywordTokens(keyword: string): string[] {
  return keyword
    .normalize('NFKC')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 8);
}

type TextField =
  | 'name'
  | 'office'
  | 'department'
  | 'address'
  | 'prefecture'
  | 'city'
  | 'nearestStation'
  | 'industry'
  | 'url'
  | 'clientNo'
  | 'telemaIdNo'
  | 'listName'
  | 'parentName'
  | 'telemaMemo';

const TEXT_FIELDS: TextField[] = [
  'name',
  'office',
  'department',
  'address',
  'prefecture',
  'city',
  'nearestStation',
  'industry',
  'url',
  'clientNo',
  'telemaIdNo',
  'listName',
  'parentName',
  'telemaMemo',
];

/**
 * Keyword search over everything we know about a company (request 10/30): every word must
 * match somewhere — company and former names, office, address, station, phone (digits, with
 * or without hyphens), industry, URL, numbers, list names, テレマメモ, and the notes, details
 * and contact person of its calls (the old system's 備考).
 */
export function keywordWhere(keyword: string): Prisma.CompanyWhereInput | null {
  const words = keywordTokens(keyword);
  if (words.length === 0) return null;
  return { AND: words.map(wordWhere) };
}

function wordWhere(word: string): Prisma.CompanyWhereInput {
  const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const });
  const or: Prisma.CompanyWhereInput[] = TEXT_FIELDS.map((field) => ({
    [field]: contains(word),
  }));
  const nameKey = normalizeCompanyName(word);
  if (nameKey) {
    or.push({ nameKey: { contains: nameKey } });
    or.push({ formerNames: { some: { nameKey: { contains: nameKey } } } });
  }
  // 「06-6000」「0660001234」: phone digits, when the word is a number.
  if (/^[\d\-()+]+$/.test(word)) {
    const digits = word.replace(/\D/g, '');
    if (digits.length >= 3) or.push({ phoneDigits: { contains: digits } });
  }
  or.push({
    importRows: { some: { listImport: { listName: contains(word) } } },
  });
  or.push({
    callRecords: {
      some: {
        OR: [
          { notes: contains(word) },
          { resultDetail: contains(word) },
          { contactName: contains(word) },
        ],
      },
    },
  });
  return { OR: or };
}
