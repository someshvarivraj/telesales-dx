/**
 * The sales areas テレマ pick to see the right reps and companies together (11/17). They come
 * from the 営業担当表 itself: every prefecture in it, with its cities and wards, and the reps the
 * table puts there. Nothing is fixed in the code, so a new area appears once its rule is added.
 */
export interface SalesAreaOption {
  prefecture: string;
  /** Reps of any rule in the prefecture (its cities included). */
  repIds: string[];
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
