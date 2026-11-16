/** Starts the falling leaves on a full-screen canvas; returns a function that stops them. */
export function startLeaves(
  canvas: HTMLCanvasElement,
  options?: {
    maxFalling?: number;
    every?: number;
    lake?: boolean;
    /** Lake: where Japan in stars goes — `right` of the sign-in group, or the `top` middle. */
    starMap?: 'right' | 'top';
  },
): () => void;
