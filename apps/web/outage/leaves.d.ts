/** Starts the falling leaves on a full-screen canvas; returns a function that stops them. */
export function startLeaves(
  canvas: HTMLCanvasElement,
  options?: { maxFalling?: number; every?: number },
): () => void;
