import { describe, expect, it, vi } from 'vitest';
import { plannedOutageRequestSchema } from '@telesales/shared';
import { SettingsService } from '../src/modules/settings/SettingsService.js';

const window = { startsAt: '2026-11-04T02:00:00Z', endsAt: '2026-11-04T05:00:00Z', note: 'AWS' };

function serviceWith(value: unknown) {
  const prisma = {
    appSetting: { findUnique: vi.fn().mockResolvedValue(value ? { value } : null) },
  };
  return new SettingsService(prisma as never, { record: vi.fn() } as never);
}

describe('planned outage notice', () => {
  it('shows before and during the period, and stops once it has ended', async () => {
    const service = serviceWith(window);
    expect(await service.plannedOutage(new Date('2026-11-04T01:00:00Z'))).toEqual(window);
    expect(await service.plannedOutage(new Date('2026-11-04T03:00:00Z'))).toEqual(window);
    expect(await service.plannedOutage(new Date('2026-11-04T05:00:00Z'))).toBeNull();
  });

  it('is empty when nothing is posted', async () => {
    expect(await serviceWith(null).plannedOutage()).toBeNull();
  });

  it('refuses an end before the start', () => {
    const backwards = { ...window, endsAt: '2026-11-04T01:00:00Z' };
    expect(plannedOutageRequestSchema.safeParse(backwards).success).toBe(false);
  });
});
