/**
 * 資本金 and 最寄駅 as the lists write them (11/2): kept as numbers so they can be sorted and
 * compared, and shown the Japanese way.
 */

const UNITS: [string, number][] = [
  ['兆', 1_000_000_000_000],
  ['億', 100_000_000],
  ['万', 10_000],
];

/** 「5千」「5千300」「1200」「1.5」 → the number; anything else → null. */
function segment(text: string): number | null {
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  const match = /^(\d+(?:\.\d+)?)千(\d*)$/.exec(text);
  return match ? Number(match[1]) * 1_000 + Number(match[2] || 0) : null;
}

/**
 * 「1,154,000,000」「11億5400万円」「1億」「5千万円」「３００万」 → yen. 「-」, 「不明」 or anything
 * else that is not an amount → null.
 */
export function parseCapital(text: string | null | undefined): number | null {
  const value = (text ?? '').normalize('NFKC').replace(/[,\s円]/g, '');
  if (!value || !/\d/.test(value)) return null;
  let rest = value;
  let total = 0;
  for (const [unit, size] of UNITS) {
    const index = rest.indexOf(unit);
    if (index < 0) continue;
    const amount = segment(rest.slice(0, index));
    if (amount === null) return null;
    total += amount * size;
    rest = rest.slice(index + 1);
  }
  if (rest) {
    const amount = segment(rest);
    if (amount === null) return null;
    total += amount;
  }
  return total > 0 ? Math.round(total) : null;
}

/** 1154000000 → 「11億5,400万円」, 3000000 → 「300万円」, 1500 → 「1,500円」. */
export function formatCapital(yen: number | null | undefined): string {
  if (yen === null || yen === undefined) return '';
  const group = (n: number) => n.toLocaleString('ja-JP');
  const cho = Math.floor(yen / 1_000_000_000_000);
  const oku = Math.floor((yen % 1_000_000_000_000) / 100_000_000);
  const man = Math.floor((yen % 100_000_000) / 10_000);
  const rest = yen % 10_000;
  const parts = [
    cho ? `${group(cho)}兆` : '',
    oku ? `${group(oku)}億` : '',
    man ? `${group(man)}万` : '',
    rest || (!cho && !oku && !man) ? group(rest) : '',
  ];
  return `${parts.join('')}円`;
}

/** 「中野駅 徒歩5分」「中野駅（徒歩約5分）」 → station 中野駅, 5 minutes. */
export function splitStation(text: string | null | undefined): {
  station: string | null;
  walkMinutes: number | null;
} {
  const value = (text ?? '').normalize('NFKC').trim();
  if (!value) return { station: null, walkMinutes: null };
  const match = /^(.*?)[\s(（]*徒歩\s*約?\s*(\d+)\s*分[)）]?\s*$/.exec(value);
  if (!match) return { station: value, walkMinutes: null };
  return { station: match[1]?.trim() || null, walkMinutes: Number(match[2]) };
}

/** 「中野駅（徒歩5分）」 */
export function stationLabel(station: string | null, walkMinutes: number | null): string {
  if (!station) return walkMinutes !== null ? `徒歩${walkMinutes}分` : '';
  return walkMinutes !== null ? `${station}（徒歩${walkMinutes}分）` : station;
}
