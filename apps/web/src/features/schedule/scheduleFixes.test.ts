import type { PlanDto, ScheduleResponse } from '@telesales/shared';
import { describe, expect, it } from 'vitest';
import { freeMinutes } from './calendar/layout';
import { buildEvents, type CalendarEvent, isDayOff } from './events';

const owner = { id: 'rep1', name: '営業 一' };
const other = { id: 'rep2', name: '営業 二' };

function plan(patch: Partial<PlanDto>): PlanDto {
  return {
    id: 'p1',
    owner,
    createdBy: owner,
    type: 'OTHER',
    title: '社内作業',
    companyName: null,
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
    canConfirm: false,
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
    // 9:00–18:00 without the lunch hour.
    expect(freeMinutes([], '2026-11-04')).toBe(8 * 60);
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

describe('plans with another company (feedback 11/2)', () => {
  it('shows 「会社名・件名」, or the one there is', () => {
    const [visit] = events(plan({ type: 'VISIT', companyName: 'A社', title: '提案' }));
    expect(visit?.title).toBe('A社・提案');
    const [onlyCompany] = events(plan({ type: 'VISIT', companyName: 'A社', title: 'A社' }));
    expect(onlyCompany?.title).toBe('A社');
    const [internal] = events(plan({ title: '社内会議' }));
    expect(internal?.title).toBe('社内会議');
  });
});

describe('a whole day of 休み (feedback 11/11)', () => {
  const timeOff = (kind: string, allDay: boolean): CalendarEvent => ({
    key: kind,
    kind: 'timeoff',
    personId: 'rep1',
    startsAt: '2026-11-11T00:00:00+09:00',
    endsAt: '2026-11-12T00:00:00+09:00',
    allDay,
    title: '休み',
    timeOff: { kind } as CalendarEvent['timeOff'],
  });

  it('closes the day like a holiday', () => {
    expect(isDayOff([timeOff('DAY_OFF', true)])).toBe(true);
  });

  it('keeps part-day 休み and テレマアポ停止 open', () => {
    expect(isDayOff([timeOff('PARTIAL', false)])).toBe(false);
    expect(isDayOff([timeOff('TELEMA_STOP', true)])).toBe(false);
    expect(isDayOff([])).toBe(false);
  });
});
