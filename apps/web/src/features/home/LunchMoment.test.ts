import { describe, expect, it } from 'vitest';
import { LUNCH_ANSWERS, lunchPhase } from './LunchMoment';

describe('lunch moment', () => {
  it('eats at 12 and asks at 13 only', () => {
    expect(lunchPhase(11)).toBeNull();
    expect(lunchPhase(12)).toBe('eating');
    expect(lunchPhase(13)).toBe('asking');
    expect(lunchPhase(14)).toBeNull();
  });

  it('answers every choice politely', () => {
    expect(LUNCH_ANSWERS.map((a) => a.key)).toEqual(['good', 'ok', 'notyet']);
    for (const answer of LUNCH_ANSWERS) expect(answer.reply).toMatch(/[。！]$/);
  });
});
