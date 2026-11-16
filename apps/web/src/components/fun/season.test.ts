import { describe, expect, it } from 'vitest';
import { seasonLine } from './season';

describe('season strip lines (11/16)', () => {
  it('follows the seasons', () => {
    expect(seasonLine('2026-11-16').key).toBe('momiji');
    expect(seasonLine('2027-04-02').key).toBe('sakura');
    expect(seasonLine('2027-06-20').key).toBe('rain');
    expect(seasonLine('2027-01-20').key).toBe('snow');
  });

  it('greets the days everyone knows, before the season', () => {
    expect(seasonLine('2027-01-02').text).toContain('あけましておめでとうございます');
    expect(seasonLine('2027-02-03').text).toContain('節分');
    expect(seasonLine('2026-12-30').text).toContain('よいお年を');
  });

  it('mentions today’s or tomorrow’s public holiday', () => {
    expect(seasonLine('2026-11-23', '勤労感謝の日').text).toMatch(/^今日は勤労感謝の日です。/);
    expect(seasonLine('2026-11-22', null, '勤労感謝の日').text).toMatch(
      /^明日は勤労感謝の日です。/,
    );
  });
});
