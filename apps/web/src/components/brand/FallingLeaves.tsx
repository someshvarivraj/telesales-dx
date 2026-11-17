import { useEffect, useRef } from 'react';
import { cn } from '@/components/ui/cn';
import { startLeaves } from '../../../outage/leaves.js';

/**
 * Red maple leaves drifting down (request 11/12: the sign-in and maintenance screens only).
 * By default they gather at the bottom in one or two layers, as on the maintenance page.
 * `lake` (sign-in, 11/13): they land on a calm lake instead, float and drift; a click or tap on
 * the water makes a ripple that pushes them away. The canvas itself never takes clicks; still
 * for people who prefer reduced motion.
 */
export function FallingLeaves({ className, lake = false }: { className?: string; lake?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return startLeaves(ref.current, { lake });
  }, [lake]);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={cn('pointer-events-none fixed inset-0 h-full w-full', className)}
    />
  );
}
