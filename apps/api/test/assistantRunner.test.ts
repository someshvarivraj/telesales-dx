import { describe, expect, it } from 'vitest';
import type { Actor } from '../src/domain/access/AccessPolicy.js';
import type { AppointmentBookingService } from '../src/modules/appointments/AppointmentBookingService.js';
import type { AppointmentWorkService } from '../src/modules/appointments/AppointmentWorkService.js';
import { AssistantActionRunner } from '../src/modules/assistant/AssistantActionRunner.js';
import type { CallRecordService } from '../src/modules/callRecords/CallRecordService.js';
import type { ScheduleService } from '../src/modules/schedule/ScheduleService.js';

const actor = { id: 'u1' } as Actor;
const REP = '11111111-1111-4111-8111-111111111111';
const COMPANY = '22222222-2222-4222-8222-222222222222';
const APPOINTMENT = '33333333-3333-4333-8333-333333333333';

function runnerWith(calls: unknown[]) {
  return new AssistantActionRunner({
    schedule: {
      createPlan: async (...args: unknown[]) => calls.push(['plan', ...args.slice(1)]),
    } as unknown as ScheduleService,
    callRecords: {
      create: async (...args: unknown[]) => calls.push(['call', ...args.slice(1)]),
    } as unknown as CallRecordService,
    work: {
      requestChange: async (...args: unknown[]) => calls.push(['change', ...args.slice(1)]),
    } as unknown as AppointmentWorkService,
    booking: {
      create: async (...args: unknown[]) => {
        calls.push(['appointment', ...args.slice(1)]);
        return { id: APPOINTMENT };
      },
    } as unknown as AppointmentBookingService,
  });
}

describe('MoraBot 確定', () => {
  it('saves a plan through the schedule service as the person', async () => {
    const calls: unknown[] = [];
    const link = await runnerWith(calls).run(actor, {
      kind: 'plan',
      link: '/schedule',
      payload: {
        body: {
          ownerId: REP,
          type: 'VISIT',
          title: '打ち合わせ',
          startsAt: '2026-11-04T01:00:00.000Z',
          endsAt: '2026-11-04T02:00:00.000Z',
        },
      },
    });
    expect(link).toBe('/schedule?date=2026-11-04');
    expect(calls).toMatchObject([['plan', { ownerId: REP, title: '打ち合わせ', allDay: false }]]);
  });

  it('books an appointment and opens the N1 mail screen', async () => {
    const calls: unknown[] = [];
    const link = await runnerWith(calls).run(actor, {
      kind: 'appointment',
      link: `/companies/${COMPANY}`,
      payload: {
        body: {
          source: 'CALL_STATUS',
          companyId: COMPANY,
          salesRepId: REP,
          startsAt: '2026-11-04T01:00:00.000Z',
          endsAt: '2026-11-04T02:00:00.000Z',
          format: 'VISIT',
        },
      },
    });
    expect(link).toBe(`/appointments/${APPOINTMENT}/mail/booking`);
    expect(calls).toMatchObject([['appointment', { companyId: COMPANY, format: 'VISIT' }]]);
  });

  it('refuses a payload that does not validate', async () => {
    const calls: unknown[] = [];
    await expect(
      runnerWith(calls).run(actor, {
        kind: 'changeRequest',
        link: '/',
        payload: { appointmentId: 'not-a-uuid', message: '' },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(calls).toEqual([]);
  });
});
