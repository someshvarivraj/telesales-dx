import { useEffect, useRef } from 'react';
import { cn } from '@/components/ui/cn';
import { startLeaves } from '../../../outage/leaves.js';

/**
 * Red maple leaves drifting down (request 11/12: the sign-in and maintenance screens only).
 * By default they gather at the bottom in one or two layers, as on the maintenance page.
 * `lake` (sign-in, 11/13): they land on a calm lake instead, float and drift; a click or tap on
 * the water makes a ripple that pushes them away. `connectStars` (11/16): join the sky's stars
 * into the map of Japan. The canvas itself never takes clicks; still for reduced motion.
 */
export function FallingLeaves({
  className,
  lake = false,
  connectStars = false,
}: {
  className?: string;
  lake?: boolean;
  connectStars?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const handle = useRef<ReturnType<typeof startLeaves> | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const stop = startLeaves(ref.current, { lake });
    handle.current = stop;
    return () => {
      handle.current = null;
      stop();
    };
  }, [lake]);
  useEffect(() => {
    handle.current?.connectStars?.(connectStars);
  }, [connectStars, lake]);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={cn('pointer-events-none fixed inset-0 h-full w-full', className)}
    />
  );
}
