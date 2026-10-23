import { CalendarClock, MapPin, StickyNote, UserRound, Users } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/components/ui/cn';
import { formatRange } from '@/lib/format';
import { ja } from '@/i18n/ja';
import { type CalendarEvent, EVENT_STYLE } from '../events';
import { hoursLabel } from './layout';

export type PeekBinder = (event: CalendarEvent) => {
  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave: () => void;
};

const WIDTH = 288;

/**
 * Hovering an event shows a quiet card with everything about it — no click needed to read
 * who, when and what. Opens after a short pause so moving the mouse across the grid stays calm.
 */
export function useEventPeek(): { bind: PeekBinder; layer: ReactNode } {
  const [peek, setPeek] = useState<{ event: CalendarEvent; rect: DOMRect } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setPeek(null);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', hide, true);
    window.addEventListener('pointerdown', hide, true);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('pointerdown', hide, true);
      window.clearTimeout(timer.current);
    };
  }, [hide]);

  const bind: PeekBinder = useCallback(
    (event) => ({
      onMouseEnter: (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setPeek({ event, rect }), 380);
      },
      onMouseLeave: hide,
    }),
    [hide],
  );

  let layer: ReactNode = null;
  if (peek) {
    const { event, rect } = peek;
    const style = EVENT_STYLE[event.kind];
    const right = rect.right + 10 + WIDTH < window.innerWidth;
    const left = right ? rect.right + 10 : Math.max(8, rect.left - WIDTH - 10);
    const top = Math.max(8, Math.min(rect.top, window.innerHeight - 260));
    const minutes = Math.round(
      (new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime()) / 60_000,
    );
    const plan = event.plan;
    layer = createPortal(
      <div
        role="tooltip"
        className="pop-in pointer-events-none fixed z-[80] bg-surface text-sm shadow-(--shadow-popover)"
        style={{ left, top, width: WIDTH }}
      >
        <div className={cn('h-1', style.bar)} />
        <div className="flex flex-col gap-2 p-3.5">
          <p className="text-[11px] font-bold tracking-wide text-ink-sub">{style.label}</p>
          <p className="text-[15px] leading-snug font-bold">{event.title}</p>
          <Row icon={<CalendarClock className="size-4" />}>
            {event.allDay ? '終日' : formatRange(event.startsAt, event.endsAt)}
            {!event.allDay && <span className="ml-1.5 text-ink-sub">{hoursLabel(minutes)}</span>}
          </Row>
          {plan && (
            <Row icon={<UserRound className="size-4" />}>
              {plan.owner.name}
              {plan.appointment && (
                <span className="ml-1.5 text-ink-sub">{ja.format[plan.appointment.format]}</span>
              )}
            </Row>
          )}
          {plan && plan.attendees.length > 0 && (
            <Row icon={<Users className="size-4" />}>
              {plan.attendees.map((person) => person.name).join('、')}
            </Row>
          )}
          {plan?.appointment && (
            <Row icon={<MapPin className="size-4" />}>{plan.appointment.companyName}</Row>
          )}
          {(plan?.note || event.timeOff?.note) && (
            <Row icon={<StickyNote className="size-4" />}>
              <span className="line-clamp-3 text-ink-sub">{plan?.note ?? event.timeOff?.note}</span>
            </Row>
          )}
          {event.lock && (
            <p className="text-xs text-warning-ink">{event.lock.lockedBy.name}さんが登録中です</p>
          )}
          <p className="border-t border-line pt-2 text-[11px] text-ink-sub">クリックで詳細</p>
        </div>
      </div>,
      document.body,
    );
  }
  return { bind, layer };
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-ink-sub">
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}
