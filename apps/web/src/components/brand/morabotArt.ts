import type { MoraBotMood } from './MoraBot';
import type { Theme } from './theme';

/** Artwork poses (files in public/morabot, all on the same canvas). */
export const ART: Partial<Record<MoraBotMood, string>> = {
  guide: 'guide',
  explain: 'guide',
  report: 'report',
  checking: 'report',
  call: 'call',
  callHappy: 'call-happy',
  booked: 'booked',
  schedule: 'schedule',
  writing: 'schedule',
  done: 'done',
  approved: 'done',
};
export const ART_RATIO = 466 / 560;

/** The pose image; the さくら theme has its own pink set with the same names. */
export function poseUrl(file: string, theme: Theme = 'standard'): string {
  return `${import.meta.env.BASE_URL}morabot/${theme === 'sakura' ? 'girl/' : ''}${file}.webp`;
}
