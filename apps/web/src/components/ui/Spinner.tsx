import { LoaderCircle } from 'lucide-react';
import { cn } from './cn';

interface SpinnerProps {
  className?: string;
  /** Screen-reader text. Omit when the spinner sits next to visible text. */
  label?: string;
}

export function Spinner({ className, label }: SpinnerProps) {
  return (
    <span role={label ? 'status' : undefined} className="inline-flex items-center">
      <LoaderCircle aria-hidden="true" className={cn('size-4 animate-spin', className)} />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
