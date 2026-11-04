import { describe, expect, it, vi } from 'vitest';
import { AllocationService } from '../src/modules/telema/AllocationService.js';

describe('the morning call list', () => {
  it('does not bring a C company back when 「C架電回避目安」 has passed (Sano 11/2)', async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const service = new (
      AllocationService as unknown as new (prisma: unknown) => {
        callListOn(date: string, territory: string[]): Promise<unknown[]>;
      }
    )({ $queryRaw: queryRaw });
    await service.callListOn('2026-11-05', []);
    const sql = (queryRaw.mock.calls[0]?.[0] as { strings: string[] }).strings.join(' ');
    expect(sql).toContain('next_call_date <=');
    expect(sql).not.toContain('avoid_until <=');
  });
});
