/** Starts the falling leaves on a full-screen canvas; returns a function that stops them. */
export function startLeaves(
  canvas: HTMLCanvasElement,
  options?: { maxFalling?: number; every?: number; lake?: boolean },
): (() => void) & {
  /** Lake: 「星をつなぐ」 — draw (or hide) the lines that join the sky's stars into Japan. */
  connectStars?: (on: boolean) => void;
};
