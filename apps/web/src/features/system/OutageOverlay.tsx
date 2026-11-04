import { useEffect, useRef, useState } from 'react';
import { MoraBot } from '@/components/brand/MoraBot';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api/ApiError';
import { stepBounce } from '../../../outage/bounce.js';
import { useSystemStatus } from './useSystemStatus';

const SPEED = 170;
const WIDTH = 150;
const HEIGHT = 170;
const COLORS = ['#ff5a5f', '#ffb020', '#4ade80', '#38bdf8', '#a78bfa', '#f472b6'];

/** The server cannot be reached, as opposed to a request that was refused. */
export function isServerDown(error: unknown): boolean {
  return error instanceof ApiError && [0, 502, 503, 504].includes(error.status);
}

/**
 * For a page that is already open when the server goes away (request 11/4): MoraBot bounces
 * around the screen like an old DVD player. Nothing on the page underneath is lost; it goes away
 * by itself when the server is back. Inline drawing only, since no file can be loaded now.
 */
export function OutageOverlay() {
  const status = useSystemStatus();
  const down = isServerDown(status.error);
  const [closed, setClosed] = useState(false);
  const [wasDown, setWasDown] = useState(false);
  if (down !== wasDown) {
    setWasDown(down);
    setClosed(false);
  }
  if (!down || closed) return null;
  return <Bouncing onClose={() => setClosed(true)} />;
}

function Bouncing({ onClose }: { onClose: () => void }) {
  const bot = useRef<HTMLDivElement>(null);
  const [cornerHit, setCornerHit] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const state = {
      x: Math.random() * Math.max(0, window.innerWidth - WIDTH),
      y: Math.random() * Math.max(0, window.innerHeight - HEIGHT),
      vx: SPEED * Math.SQRT1_2,
      vy: SPEED * Math.SQRT1_2,
      walls: 0,
    };
    let color = 0;
    let last: number | null = null;
    let raf = 0;
    let timer = 0;
    const frame = (now: number) => {
      const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      const maxX = Math.max(0, window.innerWidth - WIDTH);
      const maxY = Math.max(0, window.innerHeight - HEIGHT);
      const hit = stepBounce(state, dt, maxX, maxY, SPEED);
      if (hit) color = (color + 1) % COLORS.length;
      if (hit === 'corner') {
        setCornerHit(true);
        window.clearTimeout(timer);
        timer = window.setTimeout(() => setCornerHit(false), 1800);
      }
      if (bot.current) {
        bot.current.style.transform = `translate(${state.x}px, ${state.y}px)`;
        bot.current.style.filter = `drop-shadow(0 0 16px ${COLORS[color]})`;
      }
      raf = window.requestAnimationFrame(frame);
    };
    raf = window.requestAnimationFrame(frame);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, []);
  return (
    <div role="alert" className="fixed inset-0 z-[100] overflow-hidden bg-[#05070d] text-white">
      <div ref={bot} aria-hidden="true" className="absolute top-0 left-0 will-change-transform">
        <MoraBot mood={cornerHit ? 'happy' : 'default'} size={WIDTH} title="" />
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-2xl font-bold">サーバーにつながりません</p>
        <p className="text-sm text-white/70">
          メンテナンス中かもしれません。つながると自動で元の画面に戻ります。入力中の内容はそのままです。
        </p>
        {cornerHit && <p className="text-lg font-bold text-[#ffe066]">角に当たりました！</p>}
        <Button
          variant="secondary"
          size="sm"
          className="pointer-events-auto mt-3"
          onClick={onClose}
        >
          閉じて画面を見る
        </Button>
      </div>
    </div>
  );
}
