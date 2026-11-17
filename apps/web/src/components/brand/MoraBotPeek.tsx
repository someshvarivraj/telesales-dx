import { useEffect, useState } from 'react';
import { fujiOf } from '../../../outage/leaves.js';
import { MoraBot, type MoraBotMood } from './MoraBot';

/** What MoraBot says each time it peeks out, and how it looks while saying it. */
const PEEKS: { line: string; mood: MoraBotMood }[] = [
  { line: 'ばあっ！みーつけた？', mood: 'happy' },
  { line: '架電の結果、記録しました！', mood: 'callHappy' },
  { line: 'アポ確定、営業に共有しました！', mood: 'booked' },
  { line: '結果まで入力済みです！', mood: 'done' },
];
/** Places along Fuji's right slope (0 = summit edge, 1 = foot) where MoraBot peeks out. */
const SPOTS = [0.16, 0.27, 0.2, 0.33];
const HIDDEN_MS = 1400;
const RISE_MS = 700;
const PEEK_MS = 3400;
const DUCK_MS = 450;

type Phase = 'hidden' | 'peek' | 'duck';

function stillPreferred() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function screenSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Hide-and-seek behind Mt. Fuji (11/17, sign-in screen): MoraBot rises from behind the right
 * slope, looks around and says a line, ducks back and peeks out somewhere else. The part of
 * MoraBot below the slope is cut away with Fuji's own outline, so it really looks behind the
 * mountain. A click "finds" it. Wide screens only; still (always peeking) for reduced motion.
 */
export function MoraBotPeek() {
  const [screen, setScreen] = useState(screenSize);
  const [still] = useState(stillPreferred);
  const [turn, setTurn] = useState(0);
  const [phase, setPhase] = useState<Phase>(still ? 'peek' : 'hidden');
  const [found, setFound] = useState(false);

  useEffect(() => {
    const resize = () => setScreen(screenSize());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (still) return;
    const wait =
      phase === 'hidden' ? HIDDEN_MS : phase === 'peek' ? (found ? 1300 : PEEK_MS) : DUCK_MS;
    const timer = window.setTimeout(
      () => {
        if (phase === 'hidden') setPhase('peek');
        else if (phase === 'peek') setPhase('duck');
        else {
          setFound(false);
          setTurn((n) => n + 1);
          setPhase('hidden');
        }
      },
      wait + (phase === 'hidden' ? 0 : phase === 'peek' ? RISE_MS : 0),
    );
    return () => window.clearTimeout(timer);
  }, [phase, found, still]);

  const fuji = fujiOf(screen.width, screen.height);
  const size = Math.round(Math.min(118, Math.max(84, fuji.height * 0.36)));
  const spot = SPOTS[turn % SPOTS.length] ?? 0.2;
  const peek = PEEKS[turn % PEEKS.length] ?? { line: '', mood: 'happy' as MoraBotMood };
  const cx = fuji.x + fuji.summit + spot * (fuji.half - fuji.summit);
  const boxWidth = size + 24;
  const left = cx - boxWidth / 2;
  const ridgeMid = fuji.ridge(cx);
  const top = ridgeMid - size;
  const boxHeight = size * 2;
  // Keep only what is above the slope: the outline of Fuji, in this box's own coordinates.
  const points: string[] = ['0px -400px', `${boxWidth}px -400px`];
  for (let x = boxWidth; x >= 0; x -= 4) {
    points.push(`${x}px ${(fuji.ridge(left + x) - top).toFixed(1)}px`);
  }
  const shown = phase === 'peek';
  // Peeking: head and shoulders above the slope; hidden: all of it below.
  const lift = shown ? size * 0.38 : size * 1.05;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[5] max-lg:hidden">
      <div
        data-peek
        className="absolute"
        style={{
          left,
          top,
          width: boxWidth,
          height: boxHeight,
          clipPath: `polygon(${points.join(', ')})`,
        }}
      >
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            if (!shown || found) return;
            setFound(true);
          }}
          className="morabot-peek pointer-events-auto absolute left-1/2 block cursor-pointer"
          style={{
            top: 0,
            transform: `translate(-50%, ${lift}px)`,
            transitionDuration: `${shown ? RISE_MS : DUCK_MS}ms`,
          }}
        >
          <span className={shown ? 'morabot-peek-look block' : 'block'}>
            <MoraBot mood={found ? 'happy' : peek.mood} size={size} title="" />
          </span>
        </button>
      </div>
      {shown && (
        <p
          key={`${turn}-${found}`}
          className="morabot-bubble absolute border border-line bg-surface px-3 py-2 text-sm font-bold whitespace-nowrap text-ink shadow-(--shadow-raised)"
          style={{ left: cx + size * 0.45, top: ridgeMid - size * 0.95 }}
        >
          {found ? 'みつかっちゃった！' : peek.line}
        </p>
      )}
    </div>
  );
}
