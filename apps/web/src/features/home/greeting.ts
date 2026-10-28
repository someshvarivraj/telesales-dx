/**
 * The home greeting by the time of day in Japan, in formal workplace Japanese
 * (the telemarketing team liked 「おつかれさまです」 at the 10/27 test).
 * `suffix` follows the person's name; `cheer` is MoraBot's line in the bubble.
 */
export interface Greeting {
  suffix: string;
  cheer: string;
}

export function greetingAt(hour: number): Greeting {
  // Formal, as at work: おつかれさまです through the day, polite いたします lines.
  if (hour >= 5 && hour < 10) {
    return {
      suffix: 'さん、おはようございます。',
      cheer: '本日もどうぞよろしくお願いいたします。',
    };
  }
  if (hour >= 10 && hour < 12) {
    return {
      suffix: 'さん、おつかれさまです。',
      cheer: '午前中もどうぞよろしくお願いいたします。',
    };
  }
  if (hour >= 12 && hour < 13) {
    return { suffix: 'さん、おつかれさまです。', cheer: 'お昼の休憩もしっかりお取りください。' };
  }
  if (hour >= 13 && hour < 17) {
    return { suffix: 'さん、おつかれさまです。', cheer: '午後もどうぞよろしくお願いいたします。' };
  }
  if (hour >= 17 && hour < 22) {
    return { suffix: 'さん、おつかれさまです。', cheer: '本日も一日、おつかれさまでした。' };
  }
  return {
    suffix: 'さん、遅くまでおつかれさまです。',
    cheer: 'どうぞご無理のないようにお願いいたします。',
  };
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
