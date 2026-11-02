import { datedListName } from '@telesales/shared';
import { describe, expect, it } from 'vitest';

describe('リスト取り込み (request 10/29)', () => {
  it('puts the import date in front of the list name, once', () => {
    expect(datedListName(' 大阪製造業 ', '2026-10-30')).toBe('20261030_大阪製造業');
    expect(datedListName('20261030_大阪製造業', '2026-10-30')).toBe('20261030_大阪製造業');
  });
});
