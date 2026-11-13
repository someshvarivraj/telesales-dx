/** Starts the falling leaves on a full-screen canvas; returns a function that stops them. */
export function startLeaves(
  canvas: HTMLCanvasElement,
  options?: { maxFalling?: number; every?: number; lake?: boolean; evening?: boolean },
): () => void;

/** Whether the sign-in lake shows its evening scene now (17:00–5:00 JST, or `?scene=`). */
export function isEvening(now?: Date): boolean;
