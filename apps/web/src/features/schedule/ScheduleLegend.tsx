import { cn } from '@/components/ui/cn';
import { EVENT_STYLE, type EventKind } from './events';

const ORDER: EventKind[] = [
  'appointment',
  'salesAppointment',
  'plan',
  'tentative',
  'attending',
  'timeoff',
  'lock',
];

export function ScheduleLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-sub">
      {ORDER.map((kind) => (
        <li key={kind} className="flex items-center gap-1.5">
          <span className={cn('inline-block size-3 rounded-sm', EVENT_STYLE[kind].dot)} />
          {EVENT_STYLE[kind].label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-sm bg-off ring-1 ring-line" />
        土日祝・会社の休日
      </li>
    </ul>
  );
}
