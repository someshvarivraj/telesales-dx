import { describe, expect, it } from 'vitest';
import { greetingAt, jstHour } from './greeting';

describe('home greeting', () => {
  it('greets formally by the time of day', () => {
    expect(greetingAt(7).suffix).toBe('さん、おはようございます。');
    expect(greetingAt(11).suffix).toBe('さん、おつかれさまです。');
    expect(greetingAt(12).cheer).toContain('お昼');
    expect(greetingAt(15).cheer).toBe('午後もどうぞよろしくお願いいたします。');
    expect(greetingAt(18).cheer).toBe('本日も一日、おつかれさまでした。');
    expect(greetingAt(23).suffix).toBe('さん、遅くまでおつかれさまです。');
    expect(greetingAt(2).suffix).toBe('さん、遅くまでおつかれさまです。');
  });

  it('uses Japan time', () => {
    // 2026-10-27 23:30 UTC is 08:30 the next morning in Japan.
    expect(jstHour(new Date('2026-10-27T23:30:00Z'))).toBe(8);
  });
});
