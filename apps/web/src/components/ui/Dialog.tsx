import { GripHorizontal, X } from 'lucide-react';
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from './cn';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  /**
   * Drag it by the title bar, like a window, and keep the page behind it in view (a light
   * backdrop): for forms filled in while looking at the schedule (request 11/11).
   */
  movable?: boolean;
}

/** How much of a moved dialog must stay on screen, in px. */
const KEEP_VISIBLE = 120;

/** Modal built on the native <dialog> element (focus trap, Esc to close). */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  size = 'md',
  movable = false,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{
    x: number;
    y: number;
    from: { x: number; y: number };
    rect: DOMRect;
  } | null>(null);
  const openRef = useRef(open);
  const onCloseRef = useRef(onClose);
  /** Until when a file picker opened from inside counts as "still open" (ms timestamp). */
  const pickerUntil = useRef(0);
  useEffect(() => {
    openRef.current = open;
    onCloseRef.current = onClose;
  });
  const picking = () => Date.now() < pickerUntil.current;

  // A file picker opened from this dialog: Chrome treats closing the picker (Cancel or Esc)
  // as a request to close the dialog too, and may close it without asking. While a picker
  // is open, and briefly after, such requests are ignored and the dialog is put back.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const isFileInput = (target: EventTarget | null) =>
      target instanceof HTMLInputElement && target.type === 'file';
    const opened = (event: Event) => {
      if (isFileInput(event.target)) pickerUntil.current = Number.POSITIVE_INFINITY;
    };
    const settled = (event: Event) => {
      if (isFileInput(event.target)) pickerUntil.current = Date.now() + 800;
    };
    const focused = () => {
      if (pickerUntil.current === Number.POSITIVE_INFINITY) {
        pickerUntil.current = Date.now() + 800;
      }
    };
    const closed = () => {
      // Closed by the browser while the app still wants it open.
      if (!openRef.current) return;
      if (picking()) dialog.showModal?.();
      else onCloseRef.current();
    };
    dialog.addEventListener('click', opened, true);
    dialog.addEventListener('change', settled, true);
    dialog.addEventListener('cancel', settled, true);
    dialog.addEventListener('close', closed);
    window.addEventListener('focus', focused);
    return () => {
      dialog.removeEventListener('click', opened, true);
      dialog.removeEventListener('change', settled, true);
      dialog.removeEventListener('cancel', settled, true);
      dialog.removeEventListener('close', closed);
      window.removeEventListener('focus', focused);
    };
  }, []);

  // Each time it opens it starts in the middle again.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOffset({ x: 0, y: 0 });
  }

  const startDrag = (event: PointerEvent<HTMLElement>) => {
    if (!movable || event.button !== 0 || !ref.current) return;
    if ((event.target as HTMLElement).closest('button')) return;
    // Phones: the dialog fills the width, there is nowhere to move it.
    if (!window.matchMedia('(min-width: 640px)').matches) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      from: offset,
      rect: ref.current.getBoundingClientRect(),
    };
  };
  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const start = drag.current;
    if (!start) return;
    const { rect } = start;
    // Keep the title bar on screen so it can always be grabbed again.
    const left = Math.min(
      Math.max(rect.left + event.clientX - start.x, KEEP_VISIBLE - rect.width),
      window.innerWidth - KEEP_VISIBLE,
    );
    const top = Math.min(Math.max(rect.top + event.clientY - start.y, 0), window.innerHeight - 56);
    setOffset({ x: start.from.x + left - rect.left, y: start.from.y + top - rect.top });
  };
  const endDrag = () => {
    drag.current = null;
  };

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal?.();
      if (!dialog.showModal) dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      dialog.close?.();
      if (!dialog.close) dialog.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        // A file picker closed without choosing also fires a (bubbling) cancel: only Esc
        // on the dialog itself closes it.
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        if (picking()) return;
        onClose();
      }}
      aria-labelledby="dialog-title"
      className={cn(
        'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] rounded-(--radius-card) border border-line bg-surface p-0 text-ink shadow-(--shadow-raised)',
        movable ? 'backdrop:bg-ink/10' : 'backdrop:bg-ink/40',
        size === 'lg' ? 'max-w-3xl' : 'max-w-lg',
      )}
      style={
        movable && (offset.x || offset.y)
          ? { transform: `translate(${offset.x}px, ${offset.y}px)` }
          : undefined
      }
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header
            className={cn(
              'flex items-center gap-3 border-b border-line px-5 py-3.5',
              movable && 'select-none sm:cursor-move sm:bg-column/60',
            )}
            title={movable ? 'ドラッグして動かせます（ダブルクリックで中央に戻る）' : undefined}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={(event) => {
              if (movable && !(event.target as HTMLElement).closest('button'))
                setOffset({ x: 0, y: 0 });
            }}
          >
            {movable && (
              <GripHorizontal aria-hidden="true" className="hidden size-4 text-ink-sub sm:block" />
            )}
            <h2 id="dialog-title" className="text-base font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="ml-auto flex size-9 cursor-pointer items-center justify-center rounded-md text-ink-sub hover:bg-column hover:text-ink"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
