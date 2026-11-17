import { describe, expect, it } from 'vitest';
import { placeOf } from '../src/modules/area/AreaTableService.js';

describe('placeOf (sales area picker, 11/17)', () => {
  it('lists real cities and wards as they are', () => {
    expect(placeOf('神戸市北区')).toBe('神戸市北区');
  });
  it('drops the district in brackets', () => {
    expect(placeOf('上郡町（赤穂郡）')).toBe('上郡町');
  });
  it('does not list whole-prefecture or "everything else" rows as a place', () => {
    expect(placeOf('（全域）')).toBeNull();
    expect(placeOf('その他（市川市、浦安市以外）')).toBeNull();
    expect(placeOf('上記以外')).toBeNull();
    expect(placeOf(null)).toBeNull();
  });
});
