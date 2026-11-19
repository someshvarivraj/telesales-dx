import { describe, expect, it } from 'vitest';
import { slotProblemText } from './slotProblems';

describe('slotProblemText', () => {
  it('says 終日 for a whole day off (11/19: was 00:00〜00:00)', () => {
    const text = slotProblemText({
      kind: 'TIME_OFF',
      startsAt: '2026-11-18T15:00:00.000Z',
      endsAt: '2026-11-19T15:00:00.000Z',
    });
    expect(text).toContain('終日');
    expect(text).not.toContain('00:00');
  });

  it('keeps the times for part of a day', () => {
    const text = slotProblemText({
      kind: 'TIME_OFF',
      startsAt: '2026-11-19T04:00:00.000Z',
      endsAt: '2026-11-19T06:00:00.000Z',
    });
    expect(text).toContain('13:00');
  });
});
