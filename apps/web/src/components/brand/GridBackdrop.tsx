import { useEffect, useRef } from 'react';

const CELL = 32;
const MAX_LIVE = 14;
const FRAME_MS = 50;
/** While a click ripple is running the grid draws at full frame rate. */
const RIPPLE_FRAME_MS = 16;
const RIPPLE_MS = 900;
const RIPPLE_RADIUS = 240;
/** How wide (in px) the lit ring is. */
const RIPPLE_BAND = 40;
/** Line and cell colours: the page ink and the two accent colours, very faint. */
const LINE = 'rgba(30, 37, 48, 0.055)';
const ORANGE = ['194, 65, 12', '47, 107, 168'];
const SAKURA = ['190, 24, 93', '236, 72, 153'];
/** Accent colours of the current theme (read on each frame, so a switch shows at once). */
const accents = () => (document.documentElement.dataset.theme === 'sakura' ? SAKURA : ORANGE);

interface Ripple {
  x: number;
  y: number;
  born: number;
}

interface LiveCell {
  col: number;
  row: number;
  born: number;
  life: number;
  color: string;
}

/**
 * A faint blueprint grid behind the page, with a few cells that slowly appear and fade.
 * A click anywhere sends a ring of lit cells outward from that point (the cell under
 * the pointer flashes first), visible wherever the grid shows between the cards.
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
    let ripples: Ripple[] = [];
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
      for (const ripple of ripples) drawRipple(ripple, now);
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

    const drawRipple = (ripple: Ripple, now: number) => {
      const t = (now - ripple.born) / RIPPLE_MS;
      if (t < 0 || t > 1) return;
      const radius = t * RIPPLE_RADIUS;
      const fade = 1 - t;
      const home = { col: Math.floor(ripple.x / CELL), row: Math.floor(ripple.y / CELL) };
      const reach = Math.ceil((radius + RIPPLE_BAND) / CELL);
      for (let col = home.col - reach; col <= home.col + reach; col++) {
        for (let row = home.row - reach; row <= home.row + reach; row++) {
          const isHome = col === home.col && row === home.row;
          const distance = Math.hypot((col + 0.5) * CELL - ripple.x, (row + 0.5) * CELL - ripple.y);
          // Lit while the ring passes over the cell; the clicked cell flashes at once.
          const ring = 1 - Math.abs(distance - radius) / RIPPLE_BAND;
          const strength = isHome ? Math.max(ring, 1 - t * 2.5) : ring;
          if (strength <= 0) continue;
          const alpha = strength * fade;
          const color = isHome ? accents()[0] : accents()[1];
          context.fillStyle = `rgba(${color}, ${alpha * (isHome ? 0.3 : 0.2)})`;
          context.fillRect(col * CELL + 1, row * CELL + 1, CELL - 1, CELL - 1);
          context.strokeStyle = `rgba(${color}, ${alpha * 0.45})`;
          context.strokeRect(col * CELL + 0.5, row * CELL + 0.5, CELL, CELL);
        }
      }
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
        color: accents()[Math.random() < 0.7 ? 0 : 1] ?? '194, 65, 12',
      });
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const interval = ripples.length > 0 ? RIPPLE_FRAME_MS : FRAME_MS;
      if (now - last < interval || document.hidden) return;
      last = now;
      cells = cells.filter((cell) => now - cell.born < cell.life);
      ripples = ripples.filter((ripple) => now - ripple.born < RIPPLE_MS);
      if (cells.length < MAX_LIVE && Math.random() < 0.08) spawn(now);
      draw(now);
    };

    const press = (event: PointerEvent) => {
      // At most a few rings at once, so fast clicking stays light.
      ripples = [
        ...ripples.slice(-3),
        { x: event.clientX, y: event.clientY, born: performance.now() },
      ];
    };

    resize();
    window.addEventListener('resize', resize);
    if (!still) {
      frame = requestAnimationFrame(tick);
      window.addEventListener('pointerdown', press, { passive: true });
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', press);
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
