import { describe, expect, it } from 'vitest';
import { AuditChanges } from '../src/domain/audit/AuditChanges.js';

const REP_A = '11111111-1111-4111-8111-111111111111';
const REP_B = '22222222-2222-4222-8222-222222222222';

describe('AuditChanges', () => {
  it('lists only the fields that changed, as display text', () => {
    const changes = new AuditChanges().between(
      { status: 'SCHEDULED', webOnly: false, note: 'a', updatedAt: '2026-10-01T00:00:00Z' },
      { status: 'CANCELLED', webOnly: true, note: 'a', updatedAt: '2026-10-02T00:00:00Z' },
    );
    expect(changes).toEqual([
      { field: 'status', before: 'SCHEDULED', after: 'CANCELLED' },
      { field: 'webOnly', before: 'いいえ', after: 'はい' },
    ]);
  });

  it('shows times in JST and dates with slashes', () => {
    const text = new AuditChanges();
    expect(text.text('2026-10-20T01:30:00.000Z')).toBe('2026/10/20 10:30');
    expect(text.text('2026-10-20')).toBe('2026/10/20');
  });

  it('puts names in place of people ids, and hides other ids', () => {
    expect(AuditChanges.ids({ salesRepId: REP_A, attendees: [REP_B] })).toEqual([REP_A, REP_B]);
    const changes = new AuditChanges(new Map([[REP_A, '山田 太郎']])).between(
      { salesRepId: REP_A, companyId: REP_B },
      { salesRepId: null, companyId: REP_B },
    );
    expect(changes).toEqual([{ field: 'salesRepId', before: '山田 太郎', after: null }]);
  });

  it('handles created and deleted records (one side empty)', () => {
    const changes = new AuditChanges().between(null, { name: 'テスト', roles: ['SALES', 'ADMIN'] });
    expect(changes).toEqual([
      { field: 'name', before: null, after: 'テスト' },
      { field: 'roles', before: null, after: 'SALES、ADMIN' },
    ]);
  });
});
