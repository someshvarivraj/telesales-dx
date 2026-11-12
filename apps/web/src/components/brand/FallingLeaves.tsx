import { useEffect, useRef } from 'react';
import { cn } from '@/components/ui/cn';
import { startLeaves } from '../../../outage/leaves.js';

/**
 * Light golden maple leaves drifting down and gathering at the bottom in one or two layers;
 * a new leaf nudges the ones it lands on (request 11/12: the sign-in and maintenance screens
 * only). The same drawing as the maintenance page. Never takes clicks; still for people who
 * prefer reduced motion.
 */
export function FallingLeaves({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return startLeaves(ref.current);
  }, []);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={cn('pointer-events-none fixed inset-0 h-full w-full', className)}
    />
  );
}
