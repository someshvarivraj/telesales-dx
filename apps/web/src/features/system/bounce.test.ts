import { describe, expect, it } from 'vitest';
import { stepBounce } from '../../../outage/bounce.js';

function run(frames: number, dtOf: (i: number) => number, maxX: number, maxY: number) {
  const s = { x: maxX / 3, y: maxY / 2, vx: 120, vy: 120, walls: 0 };
  let corners = 0;
  let longestInCorner = 0;
  let inCorner = 0;
  const seen = new Set<string>();
  for (let i = 0; i < frames; i++) {
    const hit = stepBounce(s, dtOf(i), maxX, maxY, 170);
    if (hit === 'corner') {
      corners += 1;
      inCorner += 1;
      longestInCorner = Math.max(longestInCorner, inCorner);
    } else {
      inCorner = 0;
    }
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.x).toBeLessThanOrEqual(maxX);
    expect(s.y).toBeGreaterThanOrEqual(0);
    expect(s.y).toBeLessThanOrEqual(maxY);
    seen.add(`${Math.round(s.x / 20)},${Math.round(s.y / 20)}`);
  }
  return { corners, longestInCorner, places: seen.size };
}

describe('stepBounce', () => {
  it.each([
    ['smooth, wide', () => 1 / 60, 1100, 600],
    ['slow frames, small window', () => 0.05, 310, 288],
    ['uneven frames', (i: number) => (i % 7 === 0 ? 0.05 : 0.008), 800, 470],
  ])('keeps travelling and reaches corners: %s', (_name, dt, maxX, maxY) => {
    const result = run(40000, dt as (i: number) => number, maxX as number, maxY as number);
    // A stuck MoraBot scores a corner on every frame in the same place.
    expect(result.longestInCorner).toBeLessThanOrEqual(1);
    expect(result.corners).toBeGreaterThan(0);
    expect(result.corners).toBeLessThan(40000 / 50);
    expect(result.places).toBeGreaterThan(30);
  });

  it('comes back inside when the window shrinks, without counting a hit each frame', () => {
    const s = { x: 900, y: 500, vx: -120, vy: -120, walls: 0 };
    expect(stepBounce(s, 1 / 60, 300, 200, 170)).toBeNull();
    expect(s.x).toBe(300);
    expect(s.y).toBe(200);
    expect(stepBounce(s, 1 / 60, 300, 200, 170)).toBeNull();
    expect(s.x).toBeLessThan(300);
  });
});
