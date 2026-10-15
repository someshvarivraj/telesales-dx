import { PREFECTURE_NAMES } from '@telesales/shared';

export const PREFECTURES = PREFECTURE_NAMES;

export interface AddressParts {
  prefecture: string | null;
  city: string | null;
}

/**
 * Splits 「大阪府大阪市中央区…」 into prefecture 大阪府 and city 大阪市
 * (「○○郡○○町」 stays together). Used to find the rep from the area table.
 */
export function splitJapaneseAddress(address: string | null | undefined): AddressParts {
  const text = address?.normalize('NFKC').replace(/\s/g, '') ?? '';
  const prefecture = PREFECTURES.find((name) => text.startsWith(name)) ?? null;
  if (!prefecture) {
    return { prefecture: null, city: null };
  }
  const rest = text.slice(prefecture.length);
  const match = /^((?:[^市区町村]+?郡)?.+?[市区町村])/.exec(rest);
  return { prefecture, city: match?.[1] ?? null };
}

/** Words at the end of an address that are not part of it, e.g. 「…6F上場」 (spec §9-2). */
const LISTING_SUFFIXES = [
  '東証プライム',
  '東証スタンダード',
  '東証グロース',
  '非上場',
  '上場',
] as const;

export function splitListingSuffix(address: string): {
  address: string;
  listingStatus: string | null;
} {
  const trimmed = address.trim();
  for (const suffix of LISTING_SUFFIXES) {
    if (trimmed.endsWith(suffix)) {
      return { address: trimmed.slice(0, -suffix.length).trim(), listingStatus: suffix };
    }
  }
  return { address: trimmed, listingStatus: null };
}
