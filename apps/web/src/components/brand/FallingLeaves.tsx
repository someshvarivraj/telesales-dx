import { useEffect, useRef } from 'react';
import { cn } from '@/components/ui/cn';
import { type Season, startLeaves } from '../../../outage/leaves.js';

const SEASONS: readonly string[] = ['spring', 'summer', 'autumn', 'winter'];

/** `?season=spring` in the address shows another season (to check each one); otherwise today's. */
function seasonFromAddress(): Season | undefined {
  const asked = new URLSearchParams(window.location.search).get('season') ?? '';
  return SEASONS.includes(asked) ? (asked as Season) : undefined;
}

/**
 * The season's scene (11/27): 冬 snow, 春 cherry petals, 夏 fireflies, 秋 red maple leaves —
 * picked from today's date in Japan. Red maple leaves drifting down (request 11/12: the sign-in and maintenance screens only).
 * By default they gather at the bottom in one or two layers, as on the maintenance page.
 * `lake` (sign-in, 11/13): they land on a calm lake instead, float and drift; a click or tap on
 * the water makes a ripple that pushes them away. The canvas itself never takes clicks; still
 * for people who prefer reduced motion.
 */
export function FallingLeaves({ className, lake = false }: { className?: string; lake?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return startLeaves(ref.current, {
      lake,
      season: seasonFromAddress(),
      // The テレマ MoraBot statue in Kobe's waterfront (11/18).
      statue: `${import.meta.env.BASE_URL}morabot/girl/girl.webp`,
    });
  }, [lake]);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={cn('pointer-events-none fixed inset-0 h-full w-full', className)}
    />
  );
}
