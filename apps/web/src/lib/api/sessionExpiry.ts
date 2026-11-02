/**
 * When the session ends, as the API reports it on every signed-in response (request 11/2:
 * nobody is signed out without warning). Also remembers that a session ended on its own, so the
 * login screen can say why the person is there.
 */
type Listener = () => void;

const listeners = new Set<Listener>();
let expiresAt: number | null = null;
const ENDED_KEY = 'telesales.sessionEnded';

export const sessionExpiry = {
  get: (): number | null => expiresAt,
  set(value: string | null): void {
    const next = value ? Date.parse(value) : null;
    if (next === expiresAt || (next !== null && Number.isNaN(next))) return;
    expiresAt = next;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** The session ended by itself (not a logout): the login screen explains it once. */
  markEnded(): void {
    try {
      sessionStorage.setItem(ENDED_KEY, '1');
    } catch {
      // Private mode: the notice is only a courtesy.
    }
  },
  takeEnded(): boolean {
    try {
      const ended = sessionStorage.getItem(ENDED_KEY) === '1';
      sessionStorage.removeItem(ENDED_KEY);
      return ended;
    } catch {
      return false;
    }
  },
};
