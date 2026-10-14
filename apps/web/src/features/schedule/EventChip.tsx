import { cn } from '@/components/ui/cn';
import { formatTime } from '@/lib/format';
import { type CalendarEvent, EVENT_STYLE } from './events';

export function EventChip({
  event,
  onClick,
  compact = false,
}: {
  event: CalendarEvent;
  onClick: (event: CalendarEvent) => void;
  compact?: boolean;
}) {
  const style = EVENT_STYLE[event.kind];
  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      title={`${style.label}：${event.title}`}
      className={cn(
        'block w-full cursor-pointer truncate rounded-sm px-1.5 py-0.5 text-left text-xs leading-5 hover:brightness-95',
        style.chip,
      )}
    >
      {!event.allDay && (
        <span className="mr-1 font-bold tabular-nums">{formatTime(event.startsAt)}</span>
      )}
      {!compact && event.title}
      {compact && <span className="max-sm:hidden">{event.title}</span>}
    </button>
  );
}
