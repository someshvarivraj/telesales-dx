import { CircleCheck, X } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

/*
 * Confirm first, then say it was done (request 11/17): anything that sends something to
 * someone or settles something asks once more, and afterwards a short message says what
 * happened (「変更を依頼しました」「送信しました」…).
 */

interface ConfirmOptions {
  title: string;
  /** What will happen, in a sentence or two. */
  message?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm>(() => Promise.resolve(true));

/** Ask before a send or a final decision; resolves true when confirmed. */
export function useConfirm(): Confirm {
  return useContext(ConfirmContext);
}

let notify: (text: string) => void = () => undefined;

/** A short 「…しました」 message at the top of the screen, for a few seconds. */
export function showDone(text: string) {
  notify(text);
}

/** Put once around the app: the confirmation dialog and the done messages live here. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [asking, setAsking] = useState<
    (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  >(null);
  const [done, setDone] = useState<{ id: number; text: string }[]>([]);

  const confirm = useCallback<Confirm>(
    (options) => new Promise((resolve) => setAsking({ ...options, resolve })),
    [],
  );
  useEffect(() => {
    notify = (text) => {
      const id = Date.now() + Math.random();
      setDone((list) => [...list.slice(-2), { id, text }]);
      window.setTimeout(() => setDone((list) => list.filter((item) => item.id !== id)), 4000);
    };
    return () => {
      notify = () => undefined;
    };
  }, []);

  const answer = (ok: boolean) => {
    asking?.resolve(ok);
    setAsking(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {asking && (
        <Dialog
          open
          onClose={() => answer(false)}
          title={asking.title}
          footer={
            <>
              <Button variant="secondary" onClick={() => answer(false)}>
                戻る
              </Button>
              <Button variant={asking.danger ? 'danger' : 'primary'} onClick={() => answer(true)}>
                {asking.confirmLabel}
              </Button>
            </>
          }
        >
          {asking.message && <div className="text-sm leading-relaxed">{asking.message}</div>}
        </Dialog>
      )}
      <div
        aria-live="polite"
        className="pointer-events-none fixed top-14 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
      >
        {done.map((item) => (
          <div
            key={item.id}
            role="status"
            className="notice-toast pointer-events-auto flex items-center gap-2 border border-success/40 bg-surface px-4 py-2.5 text-sm font-bold text-ink shadow-(--shadow-popover)"
          >
            <CircleCheck aria-hidden="true" className="size-5 text-success" />
            {item.text}
            <button
              type="button"
              aria-label="閉じる"
              onClick={() => setDone((list) => list.filter((entry) => entry.id !== item.id))}
              className="ml-1 flex size-6 cursor-pointer items-center justify-center text-ink-sub hover:text-ink"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ConfirmContext.Provider>
  );
}
