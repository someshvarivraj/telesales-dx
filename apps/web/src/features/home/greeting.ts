/**
 * The home greeting by the time of day in Japan (the telemarketing team liked
 * 「おつかれさまです」 and asked for the others at the 10/27 test).
 * `suffix` follows the person's name; `cheer` is MoraBot's line in the bubble.
 */
export interface Greeting {
  suffix: string;
  cheer: string;
}

export function greetingAt(hour: number): Greeting {
  if (hour >= 5 && hour < 10) {
    return { suffix: 'さん、おはようございます！', cheer: '今日もよろしくお願いします！' };
  }
  if (hour >= 10 && hour < 12) {
    return { suffix: 'さん、こんにちは！', cheer: 'いい調子です、その調子！' };
  }
  if (hour >= 12 && hour < 13) {
    return { suffix: 'さん、こんにちは！', cheer: 'お昼休み、しっかりとってくださいね。' };
  }
  if (hour >= 13 && hour < 17) {
    return { suffix: 'さん、こんにちは！', cheer: '午後もいっしょにがんばりましょう！' };
  }
  return { suffix: 'さん、おつかれさまです。', cheer: '今日も一日おつかれさまでした！' };
}

/** The current hour in Japan, whatever the computer's time zone. */
export function jstHour(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: 'Asia/Tokyo',
    }).format(now),
  );
}
