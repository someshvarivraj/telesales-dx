import { useEffect, useState } from 'react';
import { fujiOf, mountainAt, rangeRidge } from '../../../outage/leaves.js';
import { MoraBot, type MoraBotMood } from './MoraBot';
import { ART, poseUrl } from './morabotArt';
import { LookProvider, type Theme } from './theme';

/**
 * What MoraBot says each time it peeks out, how it looks, and which MoraBot says it: the pink
 * one (テレマ) for calls and booking, the blue one (営業) for meeting results.
 */
const PEEKS: { line: string; mood: MoraBotMood; look: Theme }[] = [
  { line: 'ばあっ！みーつけた？', mood: 'happy', look: 'sakura' },
  { line: '架電の結果、記録しました！', mood: 'callHappy', look: 'sakura' },
  { line: 'ばあっ！みーつけた？', mood: 'happy', look: 'standard' },
  { line: 'アポ確定、営業に共有しました！', mood: 'booked', look: 'sakura' },
  { line: '結果まで入力済みです！', mood: 'done', look: 'standard' },
];
/**
 * Where MoraBot peeks out, one after another (11/17: always rising near the same place looked
 * like a glitch): the left slope, the summit, the right slope. Negative = left of the summit,
 * 0 = the summit itself, positive = right; the size is how far down the slope (0–1).
 */
const SPOTS = [-0.22, 0, 0.22];
const HIDDEN_MS = 1400;
const RISE_MS = 700;
const PEEK_MS = 3400;
const DUCK_MS = 450;
/** A face popping up from behind another mountain lasts this long. */
const FACE_MS = 1900;

type Phase = 'hidden' | 'peek' | 'duck';

interface Face {
  id: number;
  x: number;
  kind: 'near' | 'mid' | 'far';
  look: Theme;
}

function stillPreferred() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function screenSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

/** The part of a box above a ridge line, as a clip path in the box's own coordinates. */
function clipAbove(ridge: (x: number) => number, left: number, top: number, width: number) {
  const points = ['0px -400px', `${width}px -400px`];
  for (let x = width; x >= 0; x -= 3) points.push(`${x}px ${(ridge(left + x) - top).toFixed(1)}px`);
  return `polygon(${points.join(', ')})`;
}

/** Only clicks on the scenery itself (not on the sign-in box or the headline) count. */
function onScenery(x: number, y: number) {
  // Not every browser-like environment has it (the test runner's jsdom doesn't).
  if (typeof document.elementFromPoint !== 'function') return false;
  return document.elementFromPoint(x, y)?.hasAttribute('data-scene') === true;
}

/**
 * Hide-and-seek behind the mountains (11/17, sign-in screen). MoraBot rises from behind Mt.
 * Fuji — left slope, summit, right slope in turn — looks around and says a line, then ducks back.
 * The part below the slope is cut away with the mountain's own outline. Clicking Fuji brings it
 * out right there; clicking another mountain makes a MoraBot face (pink or blue, at random) pop
 * up from behind it for a moment. Clicking MoraBot itself "finds" it (its usual poke reaction
 * plays too). Wide screens only; still (always peeking) for reduced motion.
 */
export function MoraBotPeek() {
  const [screen, setScreen] = useState(screenSize);
  const [still] = useState(stillPreferred);
  const [turn, setTurn] = useState(0);
  const [phase, setPhase] = useState<Phase>(still ? 'peek' : 'hidden');
  // Every pose it can show is loaded and decoded first (11/17): a pose fetched while MoraBot was
  // already rising appeared late, so it looked stuck and then popped out.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let done = false;
    const finish = () => {
      if (!done) setReady(true);
      done = true;
    };
    const files = new Set<string>();
    for (const peek of PEEKS) {
      const art = ART[peek.mood];
      if (art) files.add(poseUrl(art, peek.look));
    }
    const happy = ART.happy;
    if (happy)
      for (const look of ['sakura', 'standard'] as Theme[]) files.add(poseUrl(happy, look));
    void Promise.all(
      [...files].map((src) => {
        const image = new Image();
        image.src = src;
        return image.decode().catch(() => undefined);
      }),
    ).then(finish);
    // Never wait long on a slow network: start anyway after 4 s.
    const fallback = window.setTimeout(finish, 4000);
    return () => {
      done = true;
      window.clearTimeout(fallback);
    };
  }, []);
  const [found, setFound] = useState(false);
  /** Where on Fuji it peeks when someone clicked the mountain. */
  const [clickedX, setClickedX] = useState<number | null>(null);
  const [faces, setFaces] = useState<Face[]>([]);

  useEffect(() => {
    const resize = () => setScreen(screenSize());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (still || !ready) return;
    const wait =
      phase === 'hidden'
        ? HIDDEN_MS
        : phase === 'peek'
          ? RISE_MS + (found ? 1300 : PEEK_MS)
          : DUCK_MS;
    const timer = window.setTimeout(() => {
      if (phase === 'hidden') setPhase('peek');
      else if (phase === 'peek') setPhase('duck');
      else {
        setFound(false);
        setClickedX(null);
        setTurn((n) => n + 1);
        setPhase('hidden');
      }
    }, wait);
    return () => window.clearTimeout(timer);
  }, [phase, found, still, turn, ready]);

  // Clicks on the mountains.
  useEffect(() => {
    if (still) return;
    let next = 0;
    const press = (event: PointerEvent) => {
      if (window.innerWidth < 1024 || !onScenery(event.clientX, event.clientY)) return;
      const hit = mountainAt(event.clientX, event.clientY, window.innerWidth, window.innerHeight);
      if (!hit) return;
      if (hit.kind === 'fuji') {
        setClickedX(event.clientX);
        setFound(false);
        setTurn((n) => n + 1);
        setPhase('peek');
        return;
      }
      const face: Face = {
        id: ++next,
        x: event.clientX,
        kind: hit.kind,
        look: Math.random() < 0.5 ? 'sakura' : 'standard',
      };
      setFaces((list) => [...list.slice(-3), face]);
      window.setTimeout(() => setFaces((list) => list.filter((f) => f.id !== face.id)), FACE_MS);
    };
    window.addEventListener('pointerdown', press);
    return () => window.removeEventListener('pointerdown', press);
  }, [still]);

  const fuji = fujiOf(screen.width, screen.height);
  const size = Math.round(Math.min(118, Math.max(84, fuji.height * 0.36)));
  const boxWidth = size + 24;
  const spot = SPOTS[turn % SPOTS.length] ?? 0;
  const peek = PEEKS[turn % PEEKS.length] ?? {
    line: '',
    mood: 'happy' as MoraBotMood,
    look: 'sakura' as Theme,
  };
  const slopeX =
    spot === 0
      ? fuji.x
      : fuji.x + Math.sign(spot) * (fuji.summit + Math.abs(spot) * (fuji.half - fuji.summit));
  const rawX = clickedX ?? slopeX;
  // Keep MoraBot on the screen and off the very foot of the slope.
  const cx = Math.max(boxWidth / 2 + 8, Math.min(fuji.x + fuji.half * 0.62, rawX));
  const left = cx - boxWidth / 2;
  const ridgeMid = fuji.ridge(cx);
  const top = ridgeMid - size;
  const shown = phase === 'peek';
  // Peeking: head and shoulders above the slope; hidden: all of it below.
  const lift = shown ? size * 0.38 : size * 1.05;
  const faceSize = Math.round(size * 0.42);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[5] max-lg:hidden">
      <div
        data-peek
        className="absolute"
        style={{
          left,
          top,
          width: boxWidth,
          height: size * 2,
          clipPath: clipAbove(fuji.ridge, left, top, boxWidth),
        }}
      >
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            if (shown && !found) setFound(true);
          }}
          className="morabot-peek pointer-events-auto absolute left-1/2 block -translate-x-1/2 cursor-pointer"
          style={{
            top: 0,
            // Centred with `translate`, so the transition only moves it up and down (11/17: the -50%
            // changed with each pose's width and kept restarting the rise, which then looked stuck).
            transform: `translateY(${lift}px)`,
            transitionDuration: `${shown ? RISE_MS : DUCK_MS}ms`,
          }}
        >
          <span className={shown ? 'morabot-peek-look block' : 'block'}>
            <LookProvider theme={peek.look}>
              <MoraBot mood={found ? 'happy' : peek.mood} size={size} title="" />
            </LookProvider>
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

      {faces.map((face) => {
        const ridge = (x: number) => rangeRidge(face.kind, x, screen.width, screen.height);
        const width = faceSize + 8;
        const faceLeft = face.x - width / 2;
        const faceTop = ridge(face.x) - faceSize;
        return (
          <div
            key={face.id}
            className="absolute"
            style={{
              left: faceLeft,
              top: faceTop,
              width,
              height: faceSize * 2,
              clipPath: clipAbove(ridge, faceLeft, faceTop, width),
            }}
          >
            <span
              className="morabot-face-pop absolute left-1/2 block"
              style={{ top: 0, animationDuration: `${FACE_MS}ms` }}
            >
              <LookProvider theme={face.look}>
                <MoraBot headOnly mood="happy" size={faceSize} title="" />
              </LookProvider>
            </span>
          </div>
        );
      })}
    </div>
  );
}
