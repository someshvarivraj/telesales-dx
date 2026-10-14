/**
 * Company name for matching: width-normalised, spaces removed, and legal-form words
 * (株式会社, (株) …) ignored so 「（株）サンプル」 matches 「株式会社サンプル」.
 */
export function normalizeCompanyName(name: string): string {
  return name
    .normalize('NFKC')
    .replace(/\s/g, '')
    .replace(
      /株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|一般財団法人|\(株\)|\(有\)|㈱|㈲/g,
      '',
    )
    .toLowerCase();
}

/**
 * Same company name and phone numbers that differ only in the last 1–2 digits
 * (spec §7): a warning only — the telemarketer decides whether to call.
 */
export function isSimilarNumber(a: string | null, b: string | null): boolean {
  if (!a || !b || a === b || a.length !== b.length || a.length < 3) {
    return false;
  }
  return a.slice(0, -2) === b.slice(0, -2);
}
