import { describe, expect, it } from 'vitest';
import { keywordTokens, keywordWhere } from '../src/domain/companies/keywordSearch.js';

describe('キーワード検索 (request 10/30)', () => {
  it('splits on full- and half-width spaces', () => {
    expect(keywordTokens('  大阪　建設 052 ')).toEqual(['大阪', '建設', '052']);
    expect(keywordWhere('　 ')).toBeNull();
  });

  it('needs every word to match somewhere', () => {
    const where = keywordWhere('大阪 建設') as { AND: { OR: object[] }[] };
    expect(where.AND).toHaveLength(2);
    const fields = (where.AND[0]?.OR ?? []).map((condition) => Object.keys(condition)[0]);
    expect(fields).toEqual(
      expect.arrayContaining([
        'name',
        'address',
        'nearestStation',
        'telemaMemo',
        'nameKey',
        'formerNames',
        'importRows',
        'callRecords',
      ]),
    );
    expect(fields).not.toContain('phoneDigits');
  });

  it('matches phone numbers with or without hyphens', () => {
    const where = keywordWhere('０６-６０００') as { AND: { OR: object[] }[] };
    expect(where.AND[0]?.OR).toContainEqual({ phoneDigits: { contains: '066000' } });
  });

  it('ignores legal-form words for the name key', () => {
    const where = keywordWhere('（株）サンプル') as { AND: { OR: object[] }[] };
    expect(where.AND[0]?.OR).toContainEqual({ nameKey: { contains: 'サンプル' } });
  });
});
