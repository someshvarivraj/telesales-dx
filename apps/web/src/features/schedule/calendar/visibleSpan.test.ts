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
