import { describe, expect, it } from 'vitest';
import { stationName, yahooMapRouteUrl, yahooTransitUrl } from './MapLinks';

describe('Yahoo! map links (request 11/27)', () => {
  it('reads the station name out of a 最寄駅 note', () => {
    expect(stationName('近鉄 大和八木駅 徒歩8分')).toBe('大和八木');
    expect(stationName('本町駅')).toBe('本町');
    expect(stationName('JR大阪駅、梅田駅')).toBe('大阪');
    expect(stationName('本町')).toBe('本町');
    expect(stationName('  ')).toBeNull();
  });

  it('leaves the start empty and sets the goal', () => {
    expect(yahooMapRouteUrl('大阪市北区梅田2-4-9')).toBe(
      'https://map.yahoo.co.jp/route/train?from=&to=%E5%A4%A7%E9%98%AA%E5%B8%82%E5%8C%97%E5%8C%BA%E6%A2%85%E7%94%B02-4-9',
    );
    expect(yahooTransitUrl('本町')).toBe(
      'https://transit.yahoo.co.jp/?from=&to=%E6%9C%AC%E7%94%BA',
    );
  });
});
