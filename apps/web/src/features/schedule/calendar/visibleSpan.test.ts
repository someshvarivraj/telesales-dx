import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../events';
import { freeMinutes, visibleSpan } from './layout';

const event = (startsAt: string, endsAt: string, allDay = false): CalendarEvent => ({
  key: startsAt,
  kind: 'plan' as CalendarEvent['kind'],
  personId: 'p1',
  startsAt,
  endsAt,
  allDay,
  title: '予定',
});

describe('schedule hours (request 11/11: 5:00–24:00)', () => {
  it('shows 5:00–24:00 for a normal day', () => {
    // 10:00–11:00 JST
    expect(visibleSpan([event('2026-11-04T01:00:00Z', '2026-11-04T02:00:00Z')])).toEqual({
      start: 5 * 60,
      end: 24 * 60,
    });
  });

  it('widens to whole hours when something starts before 5:00', () => {
    // 4:30–5:15 JST
    expect(visibleSpan([event('2026-11-04T19:30:00Z', '2026-11-04T20:15:00Z')])).toEqual({
      start: 4 * 60,
      end: 24 * 60,
    });
  });

  it('ignores all-day items', () => {
    expect(visibleSpan([event('2026-11-03T15:00:00Z', '2026-11-04T15:00:00Z', true)])).toEqual({
      start: 5 * 60,
      end: 24 * 60,
    });
  });
});

describe('free time stays 9:00–18:00 (request 11/11)', () => {
  it('counts an empty day as 8 hours: 9:00–18:00 without lunch, never 5:00–24:00', () => {
    expect(freeMinutes([], '2026-11-04')).toBe(8 * 60);
  });

  it('does not count early or late plans against free time', () => {
    // 6:00–8:00 and 19:00–22:00 JST
    expect(
      freeMinutes(
        [
          event('2026-11-03T21:00:00Z', '2026-11-03T23:00:00Z'),
          event('2026-11-04T10:00:00Z', '2026-11-04T13:00:00Z'),
        ],
        '2026-11-04',
      ),
    ).toBe(8 * 60);
  });
});
