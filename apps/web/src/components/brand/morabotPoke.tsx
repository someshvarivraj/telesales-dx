import { type MouseEvent, useCallback, useEffect, useRef, useState } from 'react';

/**
 * Poke MoraBot: a click anywhere MoraBot stands gets a little reaction. It jumps, spins,
 * pops its head off and back on, or giggles; poke it too many times in a row and it gets
 * (cutely) annoyed. Just for fun, so nothing here changes what the screen does.
 */
export type Reaction = 'boing' | 'spin' | 'split' | 'giggle' | 'annoyed';

const LINES: Record<Reaction, string[]> = {
  boing: ['わっ！', 'びっくりしました！', 'ぴょーん！'],
  spin: ['くるくる〜', '目が回ります〜', 'ターン！'],
  split: ['ぽんっ！…あ、戻りました', 'パーツが外れちゃいました！', 'ガシャン…カチッ！'],
  giggle: ['えへへ', 'くすぐったいです〜', '呼びました？', 'がんばりましょう！'],
  annoyed: ['もう〜！', 'つつきすぎです！', 'お仕事してください〜！'],
};
const PLAYFUL: Reaction[] = ['boing', 'spin', 'split', 'giggle'];

/** How long one reaction plays (the CSS animations match). */
const DURATION_MS = 1100;
const ANNOYED_MS = 1600;
/** Pokes closer together than this count as "in a row". */
const STREAK_MS = 2500;
const STREAK_LIMIT = 5;

const pick = <T,>(items: T[], avoid?: T): T => {
  const choices =
    items.length > 1 && avoid !== undefined ? items.filter((i) => i !== avoid) : items;
  return choices[Math.floor(Math.random() * choices.length)] ?? (items[0] as T);
};

export function usePoke() {
  const [reaction, setReaction] = useState<{ kind: Reaction; line: string; id: number } | null>(
    null,
  );
  const streak = useRef({ count: 0, last: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previous = useRef<Reaction | undefined>(undefined);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const poke = useCallback((event: MouseEvent<HTMLElement | SVGSVGElement>) => {
    // MoraBot inside a button or link (the launcher, a menu card): that click is theirs.
    if (event.currentTarget.parentElement?.closest('a, button, [role="button"]')) return;
    const now = event.timeStamp;
    const run = now - streak.current.last < STREAK_MS ? streak.current.count + 1 : 1;
    streak.current = { count: run, last: now };
    const kind: Reaction = run >= STREAK_LIMIT ? 'annoyed' : pick(PLAYFUL, previous.current);
    if (kind === 'annoyed') streak.current.count = 0;
    previous.current = kind;
    setReaction({ kind, line: pick(LINES[kind]), id: now });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => setReaction(null),
      kind === 'annoyed' ? ANNOYED_MS : DURATION_MS,
    );
  }, []);

  return { reaction, poke };
}

/** The bubble and little effects drawn around MoraBot while it reacts. */
export function PokeEffects({
  reaction,
  size,
  bubble = true,
}: {
  reaction: { kind: Reaction; line: string; id: number };
  size: number;
  /** Off where MoraBot already has its own speech bubble (the sign-in story). */
  bubble?: boolean;
}) {
  const small = size < 72 || !bubble;
  return (
    <span key={reaction.id} aria-hidden="true" className="morabot-fx">
      {!small && (
        <span
          className={`morabot-say ${reaction.kind === 'annoyed' ? 'morabot-say-annoyed' : ''}`}
          style={{ fontSize: Math.max(11, Math.min(15, size / 9)) }}
        >
          {reaction.line}
        </span>
      )}
      {reaction.kind === 'boing' && (
        <>
          <Star className="morabot-fx-burst morabot-fx-1" />
          <Star className="morabot-fx-burst morabot-fx-2" />
          <Star className="morabot-fx-burst morabot-fx-3" />
        </>
      )}
      {reaction.kind === 'spin' && <Swirl />}
      {reaction.kind === 'split' && (
        <>
          <Spark className="morabot-fx-spark morabot-fx-1" />
          <Spark className="morabot-fx-spark morabot-fx-2" />
        </>
      )}
      {reaction.kind === 'giggle' && (
        <>
          <Heart className="morabot-fx-heart morabot-fx-1" />
          <Heart className="morabot-fx-heart morabot-fx-2" />
          <Heart className="morabot-fx-heart morabot-fx-3" />
        </>
      )}
      {reaction.kind === 'annoyed' && (
        <>
          <Vein />
          <Puff className="morabot-fx-puff morabot-fx-1" />
          <Puff className="morabot-fx-puff morabot-fx-2" />
        </>
      )}
    </span>
  );
}

function Star({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path
        d="M12 1.5l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 8.7l7.1-.6z"
        fill="#f6a623"
        stroke="#1d2b5a"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Heart({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path
        d="M12 21s-7.5-4.6-9.6-9.2C.8 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.2 1.8-2 3.3-3.2 5.4-3.2 3.6 0 5.8 3.7 4.2 7.3C19.5 16.4 12 21 12 21z"
        fill="#f472b6"
        stroke="#9d174d"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function Spark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="#facc15" stroke="#1d2b5a" strokeWidth="1.3" />
    </svg>
  );
}

function Swirl() {
  return (
    <svg viewBox="0 0 40 40" className="morabot-fx-swirl">
      <path
        d="M20 20c0-2 2-3 3.5-2s1.5 4-1 5.5-6.5.5-7.5-3 2-8 7-8 9 4 8.5 9.5S25 31 19 31 8 26 8.5 19"
        fill="none"
        stroke="#6b7bd6"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The cartoon "annoyed" mark (four curved strokes), drawn instead of an emoji. */
function Vein() {
  return (
    <svg viewBox="0 0 40 40" className="morabot-fx-vein">
      <g fill="none" stroke="#e11d48" strokeWidth="4.5" strokeLinecap="round">
        <path d="M17 6c0 6-5 10-11 10" />
        <path d="M23 6c0 6 5 10 11 10" />
        <path d="M17 34c0-6-5-10-11-10" />
        <path d="M23 34c0-6 5-10 11-10" />
      </g>
    </svg>
  );
}

function Puff({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 32 24" className={className}>
      <path
        d="M8 20a6 6 0 0 1 0-12 8 8 0 0 1 15-2 6 6 0 0 1 1 14z"
        fill="#ffffff"
        stroke="#94a3b8"
        strokeWidth="1.6"
      />
    </svg>
  );
}
