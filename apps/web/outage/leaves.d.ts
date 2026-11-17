/** Starts the falling leaves on a full-screen canvas; returns a function that stops them. */
export function startLeaves(
  canvas: HTMLCanvasElement,
  options?: { maxFalling?: number; every?: number; lake?: boolean },
): () => void;

/** Whether a point on the screen is on the sign-in sky's moon (the grid skips its ripple there). */
export function isOnMoon(x: number, y: number, width: number): boolean;

/** Where Mt. Fuji stands on a screen of this size, as drawn; `ridge(x)` is the slope's screen y. */
export function fujiOf(
  width: number,
  height: number,
): {
  x: number;
  top: number;
  height: number;
  half: number;
  summit: number;
  ridge: (x: number) => number;
};

/** The mountain at this point of the screen (front-most first) and its ridge's screen y there. */
export function mountainAt(
  x: number,
  y: number,
  width: number,
  height: number,
): { kind: 'mid' | 'fuji' | 'far'; ridge: number } | null;

/** The ridge line of one of the three ranges at screen x, for a screen of this size. */
export function rangeRidge(
  kind: 'near' | 'mid' | 'far',
  x: number,
  width: number,
  height: number,
): number;
