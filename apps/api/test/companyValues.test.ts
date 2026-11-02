import { formatCapital, parseCapital, splitStation, stationLabel } from '@telesales/shared';
import { describe, expect, it } from 'vitest';

describe('資本金 (request 11/2)', () => {
  it('reads numbers and kanji amounts', () => {
    expect(parseCapital('1154000000')).toBe(1_154_000_000);
    expect(parseCapital('1,154,000,000')).toBe(1_154_000_000);
    expect(parseCapital('11億5400万円')).toBe(1_154_000_000);
    expect(parseCapital('１億')).toBe(100_000_000);
    expect(parseCapital('5千万円')).toBe(50_000_000);
    expect(parseCapital('300万')).toBe(3_000_000);
  });

  it('leaves 「-」 and words empty', () => {
    expect(parseCapital('-')).toBeNull();
    expect(parseCapital('不明')).toBeNull();
    expect(parseCapital('')).toBeNull();
    expect(parseCapital('約1億')).toBeNull();
  });

  it('shows amounts in 億・万', () => {
    expect(formatCapital(1_154_000_000)).toBe('11億5,400万円');
    expect(formatCapital(3_000_000)).toBe('300万円');
    expect(formatCapital(100_000_000)).toBe('1億円');
    expect(formatCapital(1_500)).toBe('1,500円');
    expect(formatCapital(null)).toBe('');
  });
});

describe('最寄駅 and 徒歩', () => {
  it('splits the walking minutes off the station', () => {
    expect(splitStation('中野駅 徒歩5分')).toEqual({ station: '中野駅', walkMinutes: 5 });
    expect(splitStation('中野駅（徒歩約12分）')).toEqual({ station: '中野駅', walkMinutes: 12 });
    expect(splitStation('中野駅')).toEqual({ station: '中野駅', walkMinutes: null });
    expect(splitStation('')).toEqual({ station: null, walkMinutes: null });
  });

  it('labels them together', () => {
    expect(stationLabel('中野駅', 5)).toBe('中野駅（徒歩5分）');
    expect(stationLabel('中野駅', null)).toBe('中野駅');
  });
});
