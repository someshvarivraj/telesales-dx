import { describe, expect, it } from 'vitest';
import {
  addMinutesToTime,
  formatDateTime,
  formatRange,
  monthRange,
  startOfWeek,
  timeOptions,
} from './format';

describe('format helpers (JST)', () => {
  it('finds the Monday of the week', () => {
    expect(startOfWeek('2026-10-15')).toBe('2026-10-12'); // Thursday → Monday
    expect(startOfWeek('2026-10-12')).toBe('2026-10-12'); // Monday stays
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12'); // Sunday belongs to the same week
  });

  it('gives the month range', () => {
    expect(monthRange('2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange('2026-12-31')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('formats instants in Japan time regardless of the device zone', () => {
    expect(formatDateTime('2026-10-15T01:00:00.000Z')).toBe('2026/10/15（木） 10:00');
    expect(formatRange('2026-10-15T01:00:00.000Z', '2026-10-15T02:00:00.000Z')).toBe(
      '10/15（木） 10:00〜11:00',
    );
  });

  it('uses 15-minute steps', () => {
    expect(timeOptions(9, 10)).toEqual(['09:00', '09:15', '09:30', '09:45', '10:00']);
    expect(addMinutesToTime('23:30', 60)).toBe('23:45');
  });
});
