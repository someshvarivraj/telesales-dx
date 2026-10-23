import { cn } from '@/components/ui/cn';
import { initials } from './people';

/** Square initials tile in the person's calendar colour. */
export function Avatar({
  name,
  color,
  size = 'md',
  className,
}: {
  name: string;
  color: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-bold text-white',
        size === 'sm' ? 'size-5 text-[9px]' : 'size-7 text-[11px]',
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {initials(name)}
    </span>
  );
}
