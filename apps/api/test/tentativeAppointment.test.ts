import { createAppointmentRequestSchema, Permission } from '@telesales/shared';
import { describe, expect, it } from 'vitest';
import { AccessPolicy, type Actor } from '../src/domain/access/AccessPolicy.js';

const REP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function actor(id: string, ...permissions: string[]): Actor {
  return {
    id,
    can: (permission: string) => permissions.includes(permission),
    hasRole: () => false,
  } as unknown as Actor;
}

describe('仮予定・同席者 on a rep’s own appointment (11/13)', () => {
  const policy = new AccessPolicy();
  const appointmentPlan = { ownerId: REP, appointmentId: 'appt-1' };

  it('lets the rep and admins confirm a tentative appointment, not other reps', () => {
    expect(policy.canConfirmPlan(actor(REP, Permission.WriteSalesPlans), appointmentPlan)).toBe(
      true,
    );
    expect(policy.canConfirmPlan(actor(OTHER, Permission.Administer), appointmentPlan)).toBe(true);
    expect(policy.canConfirmPlan(actor(OTHER, Permission.WriteSalesPlans), appointmentPlan)).toBe(
      false,
    );
  });

  it('keeps the plan rules for plans that are not appointments', () => {
    const plan = { ownerId: REP, appointmentId: null };
    expect(policy.canConfirmPlan(actor(OTHER, Permission.WriteSalesPlans), plan)).toBe(true);
    expect(policy.canConfirmPlan(actor(OTHER), plan)).toBe(false);
  });

  it('accepts tentative and attendees in the booking request, off by default', () => {
    const base = {
      source: 'SALES_BOOKED',
      company: { name: '試験工業' },
      salesRepId: REP,
      startsAt: '2026-11-16T01:00:00.000Z',
      endsAt: '2026-11-16T01:30:00.000Z',
      format: 'VISIT',
    };
    const plain = createAppointmentRequestSchema.parse(base);
    expect(plain.tentative).toBe(false);
    expect(plain.attendeeIds).toEqual([]);
    const withExtras = createAppointmentRequestSchema.parse({
      ...base,
      tentative: true,
      attendeeIds: [OTHER],
    });
    expect(withExtras.tentative).toBe(true);
    expect(withExtras.attendeeIds).toEqual([OTHER]);
  });
});
