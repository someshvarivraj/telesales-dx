import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../events';
import { visibleSpan } from './layout';

const event = (startsAt: string, endsAt: string, allDay = false): CalendarEvent => ({
  key: startsAt,
  kind: 'plan' as CalendarEvent['kind'],
  personId: 'p1',
  startsAt,
  endsAt,
  allDay,
  title: '予定',
});

describe('schedule hours (request 10/29: 9:00–18:00)', () => {
  it('shows 9:00–18:00 for a normal day', () => {
    // 10:00–11:00 JST
    expect(visibleSpan([event('2026-11-04T01:00:00Z', '2026-11-04T02:00:00Z')])).toEqual({
      start: 9 * 60,
      end: 18 * 60,
    });
  });

  it('widens to whole hours so an early visit or late meeting is not cut off', () => {
    // 7:30–8:15 and 18:00–19:20 JST
    expect(
      visibleSpan([
        event('2026-11-04T22:30:00Z', '2026-11-04T23:15:00Z'),
        event('2026-11-05T09:00:00Z', '2026-11-05T10:20:00Z'),
      ]),
    ).toEqual({ start: 7 * 60, end: 20 * 60 });
  });

  it('ignores all-day items', () => {
    expect(visibleSpan([event('2026-11-03T15:00:00Z', '2026-11-04T15:00:00Z', true)])).toEqual({
      start: 9 * 60,
      end: 18 * 60,
    });
  });
});
