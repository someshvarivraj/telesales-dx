import type { PlanDto, ScheduleResponse } from '@telesales/shared';
import { describe, expect, it } from 'vitest';
import { freeMinutes } from './calendar/layout';
import { buildEvents, type CalendarEvent } from './events';

const owner = { id: 'rep1', name: '営業 一' };
const other = { id: 'rep2', name: '営業 二' };

function plan(patch: Partial<PlanDto>): PlanDto {
  return {
    id: 'p1',
    owner,
    createdBy: owner,
    type: 'OTHER',
    title: '社内作業',
    startsAt: '2026-11-04T01:00:00Z',
    endsAt: '2026-11-04T02:00:00Z',
    allDay: false,
    status: 'FIXED',
    holidayWork: false,
    note: null,
    candidateGroupId: null,
    seriesId: null,
    attendees: [],
    appointment: null,
    canEdit: true,
    ...patch,
  };
}

const events = (...plans: PlanDto[]): CalendarEvent[] =>
  buildEvents({ plans, timeOff: [], locks: [] } as unknown as ScheduleResponse);

describe('schedule (feedback 10/30)', () => {
  it('an all-day plan leaves no free time that day', () => {
    // 11/4 00:00 – 11/5 00:00 JST
    const allDay = events(
      plan({ allDay: true, startsAt: '2026-11-03T15:00:00Z', endsAt: '2026-11-04T15:00:00Z' }),
    );
    expect(freeMinutes(allDay, '2026-11-04')).toBe(0);
    expect(freeMinutes([], '2026-11-04')).toBe(9 * 60);
  });

  it('people added to a tentative plan show it as tentative too', () => {
    const list = events(plan({ status: 'TENTATIVE', attendees: [other] }));
    expect(list.map((event) => [event.personId, event.kind])).toEqual([
      ['rep1', 'tentative'],
      ['rep2', 'tentative'],
    ]);
  });

  it('people added to a fixed plan still show 同席', () => {
    const list = events(plan({ attendees: [other] }));
    expect(list.find((event) => event.personId === 'rep2')?.kind).toBe('attending');
  });
});
