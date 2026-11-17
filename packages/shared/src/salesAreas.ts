/**
 * The sales areas テレマ pick to see the right reps and companies together (11/17). They come
 * from the 営業担当表 itself: every prefecture in it, with its cities and wards, and the reps the
 * table puts there. Nothing is fixed in the code, so a new area appears once its rule is added.
 */
export interface SalesAreaOption {
  prefecture: string;
  /** Reps of any rule in the prefecture (its cities included). */
  repIds: string[];
  /** Reps whose rule covers the prefecture as a whole (（全域）, その他…, no city). */
  wideRepIds: string[];
  cities: { city: string; repIds: string[] }[];
}

/** One chosen area: a whole prefecture, or one city or ward of it. */
export interface SalesAreaPick {
  prefecture: string;
  city: string | null;
}

export function areaLabel(pick: SalesAreaPick | null): string {
  return pick ? [pick.prefecture, pick.city].filter(Boolean).join(' ') : 'すべてのエリア';
}

/** The reps the 営業担当表 puts in the chosen area. */
export function repIdsOfArea(options: readonly SalesAreaOption[], pick: SalesAreaPick | null) {
  if (!pick) return null;
  const prefecture = options.find((option) => option.prefecture === pick.prefecture);
  if (!prefecture) return new Set<string>();
  if (!pick.city) return new Set(prefecture.repIds);
  return new Set(prefecture.cities.find((c) => c.city === pick.city)?.repIds ?? []);
}

/**
 * Where one rep works, by the 営業担当表 (11/17): pick 営業 A and the companies of A's area come
 * up. A rep with a whole-prefecture rule gets the prefecture, otherwise their cities.
 */
export function areasOfRep(options: readonly SalesAreaOption[], repId: string): SalesAreaPick[] {
  const picks: SalesAreaPick[] = [];
  for (const option of options) {
    if (option.wideRepIds.includes(repId)) {
      picks.push({ prefecture: option.prefecture, city: null });
      continue;
    }
    for (const city of option.cities) {
      if (city.repIds.includes(repId))
        picks.push({ prefecture: option.prefecture, city: city.city });
    }
  }
  return picks;
}

/** 「兵庫県（神戸市北区・神戸市西区 ほか3）」: a rep's area in a few words. */
export function areasSummary(picks: readonly SalesAreaPick[]): string {
  const byPrefecture = new Map<string, string[]>();
  for (const pick of picks) {
    const cities = byPrefecture.get(pick.prefecture) ?? [];
    if (pick.city) cities.push(pick.city);
    byPrefecture.set(pick.prefecture, cities);
  }
  return [...byPrefecture.entries()]
    .map(([prefecture, cities]) =>
      cities.length === 0
        ? prefecture
        : `${prefecture}（${cities.slice(0, 2).join('・')}${cities.length > 2 ? ` ほか${cities.length - 2}` : ''}）`,
    )
    .join('、');
}
