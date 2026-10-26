import type { MoraBotMood } from './MoraBot';

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

export function poseUrl(file: string): string {
  return `${import.meta.env.BASE_URL}morabot/${file}.webp`;
}
