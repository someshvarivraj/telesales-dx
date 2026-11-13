import { useEffect, useRef } from 'react';
import { cn } from '@/components/ui/cn';
import { startLeaves } from '../../../outage/leaves.js';

/**
 * Red maple leaves drifting down (request 11/12: the sign-in and maintenance screens only).
 * By default they gather at the bottom in one or two layers, as on the maintenance page.
 * `lake` (sign-in, 11/13): they land on a calm lake instead, float and drift; a click or tap on
 * the water makes a ripple that pushes them away. `evening`: the same lake at dusk. The canvas itself never takes clicks; still
 * for people who prefer reduced motion.
 */
export function FallingLeaves({
  className,
  lake = false,
  evening = false,
}: {
  className?: string;
  lake?: boolean;
  /** Lake only: the dusk scene with the moon, stars and shooting stars (11/13). */
  evening?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return startLeaves(ref.current, { lake, evening });
  }, [lake, evening]);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed inset-0 h-full w-full',
        // Dark before the first frame is drawn, so the light headline never sits on white.
        lake && evening && 'bg-[#1b2347]',
        className,
      )}
    />
  );
}
