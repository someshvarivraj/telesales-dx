import { useEffect, useRef } from 'react';

const CELL = 32;
const MAX_LIVE = 14;
const FRAME_MS = 50;
/** Line and cell colours: the page ink and the two accent colours, very faint. */
const LINE = 'rgba(30, 37, 48, 0.055)';
const ACCENTS = ['194, 65, 12', '47, 107, 168'];

interface LiveCell {
  col: number;
  row: number;
  born: number;
  life: number;
  color: string;
}

/**
 * A faint blueprint grid behind the page, with a few cells that slowly appear and fade.
 * Drawn by the shared layouts, so every role and the sign-in screens look the same.
 * Sits behind everything (cards and menus stay plain white), never takes clicks, pauses
 * when the tab is hidden, and stays still for people who prefer reduced motion.
 */
export function GridBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let cells: LiveCell[] = [];
    let frame = 0;
    let last = 0;

    const draw = (now: number) => {
      context.clearRect(0, 0, width, height);
      for (const cell of cells) {
        const t = (now - cell.born) / cell.life;
        // Fade in, hold, fade out.
        const alpha = Math.sin(Math.PI * Math.min(Math.max(t, 0), 1)) * 0.09;
        context.fillStyle = `rgba(${cell.color}, ${alpha})`;
        context.fillRect(cell.col * CELL + 1, cell.row * CELL + 1, CELL - 1, CELL - 1);
        context.strokeStyle = `rgba(${cell.color}, ${alpha * 2.2})`;
        context.strokeRect(cell.col * CELL + 0.5, cell.row * CELL + 0.5, CELL, CELL);
      }
      context.beginPath();
      for (let x = 0.5; x <= width; x += CELL) {
        context.moveTo(x, 0);
        context.lineTo(x, height);
      }
      for (let y = 0.5; y <= height; y += CELL) {
        context.moveTo(0, y);
        context.lineTo(width, y);
      }
      context.strokeStyle = LINE;
      context.lineWidth = 1;
      context.stroke();
    };

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(performance.now());
    };

    const spawn = (now: number) => {
      cells.push({
        col: Math.floor(Math.random() * Math.ceil(width / CELL)),
        row: Math.floor(Math.random() * Math.ceil(height / CELL)),
        born: now,
        life: 2600 + Math.random() * 3200,
        color: ACCENTS[Math.random() < 0.7 ? 0 : 1] ?? '194, 65, 12',
      });
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - last < FRAME_MS || document.hidden) return;
      last = now;
      cells = cells.filter((cell) => now - cell.born < cell.life);
      if (cells.length < MAX_LIVE && Math.random() < 0.08) spawn(now);
      draw(now);
    };

    resize();
    window.addEventListener('resize', resize);
    if (!still) frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
