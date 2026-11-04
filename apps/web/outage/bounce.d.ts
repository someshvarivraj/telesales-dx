export interface BounceState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  walls: number;
}

export function stepBounce(
  state: BounceState,
  dt: number,
  maxX: number,
  maxY: number,
  speed: number,
): 'corner' | 'wall' | null;
