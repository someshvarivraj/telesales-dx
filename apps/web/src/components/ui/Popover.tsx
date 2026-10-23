import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

interface Position {
  left: number;
  top?: number;
  bottom?: number;
  origin: string;
}

/**
 * Places a floating panel under its anchor (or above it when there is no room) in a fixed
 * layer — inside the open <dialog>, if any, because the rest of the page is inert then.
 * Closes on a click outside and keeps its place while the page scrolls.
 */
export function usePopover(
  anchor: RefObject<HTMLElement | null>,
  panel: RefObject<HTMLElement | null>,
  { width, height, onClose }: { width: number; height: number; onClose: () => void },
) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [layer, setLayer] = useState<HTMLElement | null>(null);

  const place = useCallback(() => {
    const rect = anchor.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setPosition(
      below < height + 16 && rect.top > below
        ? { left, bottom: window.innerHeight - rect.top + 6, origin: 'bottom left' }
        : { left, top: rect.bottom + 6, origin: 'top left' },
    );
  }, [anchor, width, height]);

  const show = useCallback(() => {
    setLayer(anchor.current?.closest('dialog') ?? document.body);
    place();
    setOpen(true);
  }, [anchor, place]);

  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!anchor.current?.contains(target) && !panel.current?.contains(target)) {
        setOpen(false);
        onClose();
      }
    };
    const reposition = (event: Event) => {
      if (panel.current?.contains(event.target as Node)) return;
      place();
    };
    document.addEventListener('mousedown', outside);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', outside);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, anchor, panel, place, onClose]);

  return { open, show, hide, position, layer };
}

/** The floating panel itself: hairline, long soft shadow, a short pop from its anchor. */
export function PopoverPanel({
  state,
  panelRef,
  width,
  className,
  children,
  label,
}: {
  state: ReturnType<typeof usePopover>;
  panelRef: RefObject<HTMLDivElement | null>;
  width: number;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  if (!state.open || !state.position || !state.layer) return null;
  const style: CSSProperties & { '--pop-origin': string } = {
    left: state.position.left,
    top: state.position.top,
    bottom: state.position.bottom,
    width,
    '--pop-origin': state.position.origin,
  };
  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      className={cn('pop-in fixed z-[70] bg-surface shadow-(--shadow-popover)', className)}
      style={style}
    >
      {children}
    </div>,
    state.layer,
  );
}
