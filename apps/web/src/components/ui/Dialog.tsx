import { X } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { cn } from './cn';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}

/** Modal built on the native <dialog> element (focus trap, Esc to close). */
export function Dialog({ open, title, onClose, children, footer, size = 'md' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

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
        onClose();
      }}
      aria-labelledby="dialog-title"
      className={cn(
        'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] rounded-(--radius-card) border border-line bg-surface p-0 text-ink shadow-(--shadow-raised) backdrop:bg-ink/40',
        size === 'lg' ? 'max-w-3xl' : 'max-w-lg',
      )}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex items-center gap-3 border-b border-line px-5 py-3.5">
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
