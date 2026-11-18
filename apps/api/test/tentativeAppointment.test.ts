import { createAppointmentRequestSchema, Permission } from '@telesales/shared';
import { describe, expect, it } from 'vitest';
import { AccessPolicy, type Actor } from '../src/domain/access/AccessPolicy.js';
import type { AuditLogger } from '../src/domain/audit/AuditLogger.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { NotificationService } from '../src/modules/notifications/NotificationService.js';
import { ScheduleService } from '../src/modules/schedule/ScheduleService.js';
import type { SettingsService } from '../src/modules/settings/SettingsService.js';
import type { SlotGuard } from '../src/modules/schedule/SlotGuard.js';

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

  it('lets only the calendar owner (or an admin) confirm a 仮予定 that is not an appointment', () => {
    const plan = { ownerId: REP, appointmentId: null, createdById: OTHER, status: 'TENTATIVE' };
    expect(policy.canConfirmPlan(actor(REP, Permission.WriteSalesPlans), plan)).toBe(true);
    expect(policy.canConfirmPlan(actor(OTHER, Permission.WriteSalesPlans), plan)).toBe(false);
    expect(policy.canConfirmPlan(actor(OTHER, Permission.Administer), plan)).toBe(true);
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

describe('候補日 on a rep’s own 仮予定アポ (11/16)', () => {
  const base = {
    source: 'SALES_BOOKED',
    company: { name: '試験工業' },
    salesRepId: REP,
    startsAt: '2026-11-16T01:00:00.000Z',
    endsAt: '2026-11-16T01:30:00.000Z',
    format: 'VISIT',
    tentative: true,
  };

  it('accepts up to nine more candidate times, none by default', () => {
    expect(createAppointmentRequestSchema.parse(base).candidates).toEqual([]);
    const slot = { startsAt: '2026-11-17T01:00:00.000Z', endsAt: '2026-11-17T01:30:00.000Z' };
    expect(
      createAppointmentRequestSchema.parse({ ...base, candidates: Array(9).fill(slot) }).candidates,
    ).toHaveLength(9);
    expect(
      createAppointmentRequestSchema.safeParse({ ...base, candidates: Array(10).fill(slot) })
        .success,
    ).toBe(false);
  });

  it('confirming another candidate moves the appointment there and removes the rest', async () => {
    const person = { id: REP, name: '千原' };
    const row = <T extends Record<string, unknown>>(fields: T) => ({
      ownerId: REP,
      createdById: REP,
      type: 'VISIT',
      title: '試験工業',
      allDay: false,
      holidayWork: false,
      note: null,
      companyName: null,
      seriesId: null,
      recurrenceRule: null,
      owner: person,
      createdBy: person,
      attendees: [],
      appointment: null,
      ...fields,
    });
    const candidate = row({
      id: 'cand',
      appointmentId: null,
      status: 'TENTATIVE',
      candidateGroupId: 'group',
      startsAt: new Date('2026-11-18T05:00:00.000Z'),
      endsAt: new Date('2026-11-18T05:30:00.000Z'),
    });
    const anchor = row({
      id: 'anchor',
      appointmentId: 'appt-1',
      status: 'TENTATIVE',
      candidateGroupId: 'group',
      startsAt: new Date('2026-11-16T01:00:00.000Z'),
      endsAt: new Date('2026-11-16T01:30:00.000Z'),
    });
    const calls: { removed?: unknown; appointment?: unknown; plan?: Record<string, unknown> } = {};
    const tx = {
      schedulePlan: {
        updateMany: async (args: unknown) => {
          calls.removed = args;
          return { count: 2 };
        },
        update: async ({ data }: { data: Record<string, unknown> }) => {
          calls.plan = data;
          return { ...anchor, ...data };
        },
      },
      appointment: {
        update: async (args: unknown) => {
          calls.appointment = args;
          return {};
        },
      },
    };
    let lookups = 0;
    const prisma = {
      schedulePlan: { findFirst: async () => (lookups++ === 0 ? candidate : anchor) },
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    } as unknown as PrismaClient;
    const service = new ScheduleService(
      prisma,
      {} as SlotGuard,
      new AccessPolicy(),
      {} as SettingsService,
      { notify: async () => undefined } as unknown as NotificationService,
      { record: async () => undefined } as unknown as AuditLogger,
    );

    const dto = await service.confirmCandidate(actor(REP, Permission.WriteSalesPlans), 'cand');

    expect(dto.id).toBe('anchor');
    expect(dto.status).toBe('FIXED');
    expect(calls.removed).toEqual({
      where: { candidateGroupId: 'group', id: { not: 'anchor' }, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(calls.appointment).toEqual({
      where: { id: 'appt-1' },
      data: {
        startsAt: candidate.startsAt,
        endsAt: candidate.endsAt,
        version: { increment: 1 },
      },
    });
    expect(calls.plan).toMatchObject({
      status: 'FIXED',
      candidateGroupId: null,
      startsAt: candidate.startsAt,
    });
  });

  it('only the rep or an admin may confirm a candidate of someone’s appointment', async () => {
    const plan = { id: 'cand', appointmentId: null, status: 'TENTATIVE', candidateGroupId: 'g' };
    const anchor = { id: 'anchor', ownerId: REP, appointmentId: 'appt-1' };
    let lookups = 0;
    const prisma = {
      schedulePlan: { findFirst: async () => (lookups++ === 0 ? plan : anchor) },
    } as unknown as PrismaClient;
    const service = new ScheduleService(
      prisma,
      {} as SlotGuard,
      new AccessPolicy(),
      {} as SettingsService,
      {} as NotificationService,
      {} as AuditLogger,
    );
    await expect(
      service.confirmCandidate(actor(OTHER, Permission.WriteSalesPlans), 'cand'),
    ).rejects.toThrow();
  });
});

describe('own plans only; 仮予定 on another rep’s calendar (11/18)', () => {
  const policy = new AccessPolicy();
  const rep = actor(REP, Permission.WriteSalesPlans);
  const other = actor(OTHER, Permission.WriteSalesPlans);
  const admin = actor(OTHER, Permission.Administer);

  it('lets a rep change their own plans, not other reps’ plans', () => {
    const own = { ownerId: REP, appointmentId: null, createdById: REP, status: 'FIXED' };
    expect(policy.canEditPlan(rep, own)).toBe(true);
    expect(policy.canEditPlan(other, own)).toBe(false);
    expect(policy.canEditPlan(admin, own)).toBe(true);
  });

  it('lets a rep change the 仮予定 they put on another rep’s calendar while it is tentative', () => {
    const proposed = { ownerId: REP, appointmentId: null, createdById: OTHER, status: 'TENTATIVE' };
    expect(policy.canEditPlan(other, proposed)).toBe(true);
    // The calendar's owner may change it too.
    expect(policy.canEditPlan(rep, proposed)).toBe(true);
    // Once confirmed it belongs to the owner alone.
    expect(policy.canEditPlan(other, { ...proposed, status: 'FIXED' })).toBe(false);
  });

  it('allows only a 仮予定 on another rep’s calendar', () => {
    expect(policy.canPlacePlan(other, REP, 'TENTATIVE')).toBe(true);
    expect(policy.canPlacePlan(other, REP, 'FIXED')).toBe(false);
    expect(policy.canPlacePlan(other, OTHER, 'FIXED')).toBe(true);
    expect(policy.canPlacePlan(admin, REP, 'FIXED')).toBe(true);
    expect(policy.canPlacePlan(actor(OTHER), OTHER, 'FIXED')).toBe(false);
  });

  it('never lets anyone edit a plan that is an appointment directly', () => {
    const appointment = {
      ownerId: REP,
      appointmentId: 'appt-1',
      createdById: REP,
      status: 'FIXED',
    };
    expect(policy.canEditPlan(rep, appointment)).toBe(false);
    expect(policy.canEditPlan(admin, appointment)).toBe(false);
  });
});
