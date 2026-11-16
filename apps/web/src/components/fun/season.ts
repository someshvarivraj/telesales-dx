/**
 * The season and a few days everyone in Japan knows (11/16), for the strip at the top of the app.
 * Dates are in Japan time. `holiday` is a public holiday name from the calendar, when there is one.
 */
export type SeasonKey =
  'snow' | 'plum' | 'sakura' | 'green' | 'rain' | 'summer' | 'moon' | 'momiji';

export interface SeasonLine {
  key: SeasonKey;
  text: string;
}

const SEASONS: { from: string; key: SeasonKey; text: string }[] = [
  { from: '01-01', key: 'snow', text: '寒い日が続きます。あたたかくしてお過ごしください。' },
  { from: '02-10', key: 'plum', text: '梅の花がほころぶ季節になりました。' },
  { from: '03-20', key: 'sakura', text: '桜の季節です。新しい出会いが楽しみですね。' },
  { from: '04-20', key: 'green', text: '新緑がまぶしい季節になりました。' },
  { from: '06-05', key: 'rain', text: '梅雨の季節です。移動の際は足元にお気をつけください。' },
  { from: '07-15', key: 'summer', text: '暑い日が続きます。こまめに水分をとってくださいね。' },
  { from: '09-10', key: 'moon', text: 'お月見の季節です。秋の夜長をお楽しみください。' },
  { from: '10-15', key: 'momiji', text: '紅葉が色づく季節になりました。' },
  { from: '12-01', key: 'snow', text: '師走です。寒さに気をつけてお過ごしください。' },
];

/** Days with their own greeting: [from, to] as MM-DD. */
const DAYS: { from: string; to: string; key: SeasonKey; text: string }[] = [
  {
    from: '01-01',
    to: '01-07',
    key: 'plum',
    text: 'あけましておめでとうございます。本年もよろしくお願いいたします。',
  },
  { from: '02-03', to: '02-03', key: 'plum', text: '今日は節分です。鬼は外、福は内！' },
  { from: '03-03', to: '03-03', key: 'sakura', text: '今日はひなまつりです。' },
  { from: '05-05', to: '05-05', key: 'green', text: '今日はこどもの日です。' },
  { from: '07-07', to: '07-07', key: 'summer', text: '今日は七夕です。願いごとは決まりましたか？' },
  {
    from: '08-13',
    to: '08-16',
    key: 'summer',
    text: 'お盆の時期です。ゆっくり休めていますように。',
  },
  { from: '12-24', to: '12-25', key: 'snow', text: 'メリークリスマス。今年もあと少しです。' },
  {
    from: '12-28',
    to: '12-31',
    key: 'snow',
    text: '今年も一年、おつかれさまでした。よいお年をお迎えください。',
  },
];

export function seasonLine(
  date: string,
  holiday?: string | null,
  tomorrowHoliday?: string | null,
): SeasonLine {
  const md = date.slice(5);
  const day = DAYS.find((d) => md >= d.from && md <= d.to);
  let season = SEASONS[0];
  for (const entry of SEASONS) if (md >= entry.from) season = entry;
  const key = day?.key ?? season?.key ?? 'momiji';
  if (day) return { key, text: day.text };
  if (holiday) return { key, text: `今日は${holiday}です。${season?.text ?? ''}` };
  if (tomorrowHoliday) return { key, text: `明日は${tomorrowHoliday}です。${season?.text ?? ''}` };
  return { key, text: season?.text ?? '' };
}
