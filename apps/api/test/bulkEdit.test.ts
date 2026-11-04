import { bulkEditRequestSchema } from '@telesales/shared';
import { describe, expect, it } from 'vitest';

const companyIds = ['6f9619ff-8b86-4d11-b42d-00c04fc964ff'];

describe('一括修正 request', () => {
  it('keeps only the fields that were sent, so nothing else gets emptied', () => {
    const { changes } = bulkEditRequestSchema.parse({
      companyIds,
      changes: { phone: '06-6000-0000', office: '' },
    });
    expect(changes).toEqual({ phone: '06-6000-0000', office: null });
  });

  it('needs at least one field, and 会社名 cannot be emptied', () => {
    expect(bulkEditRequestSchema.safeParse({ companyIds, changes: {} }).success).toBe(false);
    expect(bulkEditRequestSchema.safeParse({ companyIds, changes: { name: '' } }).success).toBe(
      false,
    );
  });
});
