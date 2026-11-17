/** Starts the falling leaves on a full-screen canvas; returns a function that stops them. */
export function startLeaves(
  canvas: HTMLCanvasElement,
  options?: { maxFalling?: number; every?: number; lake?: boolean },
): () => void;

/** Whether a point on the screen is on the sign-in sky's moon (the grid skips its ripple there). */
export function isOnMoon(x: number, y: number, width: number): boolean;
