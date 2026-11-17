/**
 * The sales areas テレマ pick in the call list and the sales schedule (11/17): A 大阪, B 神戸,
 * C 京都・奈良. Each follows its team in the 営業担当表 (大阪・和歌山 / 兵庫 / 京都・滋賀・奈良),
 * so the reps and companies shown together are the ones that belong together.
 */
export const SALES_AREAS = [
  { key: 'A', label: '大阪', prefectures: ['大阪府', '和歌山県'] },
  { key: 'B', label: '神戸', prefectures: ['兵庫県'] },
  { key: 'C', label: '京都・奈良', prefectures: ['京都府', '奈良県', '滋賀県'] },
] as const;

export type SalesAreaKey = (typeof SALES_AREAS)[number]['key'];

export function prefecturesOfArea(key: SalesAreaKey | null): string[] {
  return key ? [...(SALES_AREAS.find((area) => area.key === key)?.prefectures ?? [])] : [];
}
