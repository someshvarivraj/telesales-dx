import { describe, expect, it } from 'vitest';
import { splitJapaneseAddress } from '../src/domain/area/japaneseAddress.js';
import { type AreaRule, RepFinder } from '../src/domain/area/RepFinder.js';

describe('city from an address (11/18: wards of 政令指定都市)', () => {
  it.each([
    ['兵庫県神戸市中央区加納町1-1', '兵庫県', '神戸市中央区'],
    ['大阪府大阪市北区梅田2-1-1', '大阪府', '大阪市北区'],
    ['大阪府八尾市本町2-1-1', '大阪府', '八尾市'],
    ['兵庫県赤穂郡上郡町大持207', '兵庫県', '赤穂郡上郡町'],
    ['東京都港区北青山1-2-3', '東京都', '港区'],
    ['京都府京都市下京区四条通2-1', '京都府', '京都市下京区'],
  ])('%s', (address, prefecture, city) => {
    expect(splitJapaneseAddress(address)).toEqual({ prefecture, city });
  });
});

describe('RepFinder: the more precise place wins', () => {
  const rule = (id: string, city: string | null): AreaRule => ({
    id,
    prefecture: '兵庫県',
    city,
    customerTypeCondition: null,
    companyGroupId: null,
    salesRepId: id,
    backupRepId: null,
    webOnly: false,
    validFrom: '2026-01-01',
    validTo: null,
  });
  const finder = new RepFinder([
    rule('kobe', '神戸市'),
    rule('chuo', '神戸市中央区'),
    rule('pref', null),
  ]);
  const find = (city: string) =>
    finder.find({
      prefecture: '兵庫県',
      city,
      customerType: null,
      companyGroupId: null,
      date: '2026-11-18',
    })?.id;

  it('a ward rule beats the whole-city rule', () => expect(find('神戸市中央区')).toBe('chuo'));
  it('another ward falls back to the city rule', () => expect(find('神戸市北区')).toBe('kobe'));
  it('outside Kobe: the prefecture rule', () => expect(find('明石市')).toBe('pref'));
});
