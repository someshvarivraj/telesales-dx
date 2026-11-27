export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** Japan's season on a date (now by default): 冬 from 立冬 (7 Nov) to February, 春 Mar–May, 夏 Jun–Aug, 秋 Sep to 立冬. */
export function seasonOf(date?: Date): Season;

/** Starts the falling leaves on a full-screen canvas; returns a function that stops them. */
export function startLeaves(
  canvas: HTMLCanvasElement,
  options?: {
    maxFalling?: number;
    every?: number;
    lake?: boolean;
    /** What falls; by default Japan's season today (seasonOf). */
    season?: Season;
    /** The MoraBot statue artwork drawn in the waterfront (lake only). */
    statue?: string;
  },
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
): { kind: 'near' | 'mid' | 'fuji' | 'far'; ridge: number } | null;

/** The ridge line of one of the three ranges at screen x, for a screen of this size. */
export function rangeRidge(
  kind: 'near' | 'mid' | 'far',
  x: number,
  width: number,
  height: number,
): number;
