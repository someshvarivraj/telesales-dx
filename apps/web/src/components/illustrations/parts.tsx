import type { ReactNode } from 'react';

/**
 * Drawing parts shared by the illustrations: one line colour, soft blue fills and a
 * little orange (fills only, never text). Everything is drawn in a 400 × 260 box.
 */
export const INK = '#1f3d73';
export const FILL = {
  paper: '#ffffff',
  soft: '#e5eff9',
  light: '#c9dcf2',
  mid: '#8fb0dc',
  deep: '#4f78b8',
  accent: '#ea6a1f',
  accentSoft: '#fde3cf',
  skin: '#fff7f0',
};

export const line = {
  stroke: INK,
  strokeWidth: 2.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** The pale shape behind each scene. */
export function Blob({ d }: { d?: string }) {
  return (
    <path
      d={
        d ??
        'M46 168 C30 110 70 52 140 44 C206 36 236 70 290 58 C352 44 384 98 370 152 C358 202 300 228 220 226 C140 224 62 222 46 168 Z'
      }
      fill={FILL.soft}
    />
  );
}

/** Four-point sparkle. */
export function Sparkle({ x, y, size = 10 }: { x: number; y: number; size?: number }) {
  const s = size;
  const q = s * 0.22;
  return (
    <path
      className="scene-twinkle"
      style={{ animationDelay: `-${((x + y) % 30) / 10}s` }}
      d={`M${x} ${y - s} Q${x + q} ${y - q} ${x + s} ${y} Q${x + q} ${y + q} ${x} ${y + s} Q${x - q} ${y + q} ${x - s} ${y} Q${x - q} ${y - q} ${x} ${y - s} Z`}
      fill={FILL.paper}
      {...line}
      strokeWidth={2}
    />
  );
}

/** A thick limb drawn as an outlined stroke. */
export function Limb({
  d,
  color = FILL.deep,
  width = 13,
}: {
  d: string;
  color?: string;
  width?: number;
}) {
  return (
    <>
      <path d={d} fill="none" stroke={INK} strokeWidth={width + 5} strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
    </>
  );
}

interface BustProps {
  x: number;
  /** The desk or table line the person sits behind. */
  y: number;
  /** Which way the person looks. */
  facing?: 1 | -1;
  suit?: string;
  hair?: 'short' | 'long';
  headset?: boolean;
  /** Raised hand (pointing / waving) instead of both hands on the desk. */
  raise?: boolean;
  scale?: number;
}

/** A person from the waist up, sitting behind a desk. */
export function Bust({
  x,
  y,
  facing = 1,
  suit = FILL.deep,
  hair = 'short',
  headset = false,
  raise = false,
  scale = 1,
}: BustProps) {
  const f = facing;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale * f} ${scale})`}>
      <g className="scene-breathe">
        {/* back arm */}
        <Limb d="M-30 -42 C-44 -24 -40 -6 -18 -4" color={suit} />
        {/* long hair falls to the shoulders on both sides (behind the torso) */}
        {hair === 'long' && (
          <path
            d="M-21 -94 C-29 -74 -28 -60 -22 -52 L-11 -60 L-12 -84 Z M21 -94 C29 -74 28 -60 22 -52 L11 -60 L12 -84 Z"
            fill={INK}
          />
        )}
        {/* torso */}
        <path d="M-38 0 C-40 -40 -26 -60 0 -60 C26 -60 40 -40 38 0 Z" fill={suit} {...line} />
        <path d="M-11 -58 L0 -38 L11 -58" fill={FILL.paper} {...line} strokeWidth={2} />
        <path d="M0 -38 L-3 -24 L0 -14 L3 -24 Z" fill={INK} />
        {/* neck + head (the head nods a little) */}
        <rect x={-6} y={-70} width={12} height={12} fill={FILL.skin} {...line} strokeWidth={2} />
        <g className="scene-head">
          <circle cx={0} cy={-90} r={20} fill={FILL.skin} {...line} />
          <path
            d={
              hair === 'long'
                ? 'M-21 -88 C-24 -114 22 -118 22 -90 C14 -100 0 -104 -12 -96 C-16 -94 -19 -91 -21 -88 Z'
                : 'M-20 -92 C-20 -114 20 -116 21 -94 C12 -102 -4 -104 -20 -92 Z'
            }
            fill={INK}
          />
          {/* face, turned a little toward `facing` */}
          <g className="scene-blink">
            <circle cx={4} cy={-90} r={2} fill={INK} />
            <circle cx={13} cy={-90} r={2} fill={INK} />
          </g>
          <path d="M6 -80 Q10 -77 14 -80" fill="none" {...line} strokeWidth={2} />
          {headset && (
            <>
              <path
                d="M-21 -92 C-22 -118 20 -118 21 -92"
                fill="none"
                stroke={FILL.accent}
                strokeWidth={4}
                strokeLinecap="round"
              />
              <rect
                x={-26}
                y={-98}
                width={9}
                height={15}
                fill={FILL.accent}
                {...line}
                strokeWidth={2}
              />
              <path
                d="M-20 -84 C-16 -72 -2 -70 6 -73"
                fill="none"
                stroke={INK}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
              <circle cx={7} cy={-73} r={3} fill={INK} />
            </>
          )}
        </g>
        {/* front arm */}
        {raise ? (
          <Limb d="M26 -46 C40 -60 50 -80 56 -100" color={suit} />
        ) : (
          <Limb d="M28 -42 C40 -22 36 -6 14 -4" color={suit} />
        )}
        {raise ? (
          <circle cx={57} cy={-104} r={7} fill={FILL.skin} {...line} strokeWidth={2} />
        ) : (
          <ellipse cx={10} cy={-4} rx={8} ry={5} fill={FILL.skin} {...line} strokeWidth={2} />
        )}
      </g>
    </g>
  );
}

/** A desk or table top with legs. */
export function Desk({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <g>
      <path
        d={`M${x1 + 14} ${y + 12} L${x1 + 14} ${y + 52} M${x2 - 14} ${y + 12} L${x2 - 14} ${y + 52}`}
        {...line}
      />
      <rect x={x1} y={y} width={x2 - x1} height={12} fill={FILL.paper} {...line} />
    </g>
  );
}

/** A month calendar card; `done` is the cell with the booked appointment. */
export function Calendar(props: {
  x: number;
  y: number;
  w: number;
  h: number;
  done?: [number, number];
}) {
  const { x, y, w, h } = props;
  const cols = 5;
  const rows = 4;
  // Header, margins and cells all follow the card size, so it works small or large.
  const head = Math.max(8, h * 0.13);
  const pad = w * 0.05;
  const top = y + head + pad;
  const cw = (w - pad * 2) / cols;
  const ch = (h - head - pad * 2) / rows;
  const [dc, dr] = props.done ?? [3, 1];
  const cells: ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = x + pad + c * cw;
      const cy = top + r * ch;
      const isDone = c === dc && r === dr;
      const tentative = (c === 1 && r === 2) || (c === 4 && r === 0);
      cells.push(
        <rect
          key={`${c}-${r}`}
          className={isDone ? 'scene-pulse' : undefined}
          x={cx + 2}
          y={cy + 2}
          width={cw - 4}
          height={ch - 4}
          fill={isDone ? FILL.accent : tentative ? FILL.light : FILL.paper}
          stroke={INK}
          strokeWidth={1.5}
        />,
      );
      if (isDone) {
        cells.push(
          <path
            key="check"
            d={`M${cx + cw * 0.3} ${cy + ch * 0.52} L${cx + cw * 0.45} ${cy + ch * 0.68} L${cx + cw * 0.72} ${cy + ch * 0.34}`}
            fill="none"
            stroke={FILL.paper}
            strokeWidth={Math.max(1.5, cw * 0.08)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />,
        );
      }
    }
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={FILL.paper} {...line} />
      <rect x={x} y={y} width={w} height={head} fill={FILL.deep} {...line} />
      {[0.28, 0.72].map((p) => (
        <rect
          key={p}
          x={x + w * p - head * 0.14}
          y={y - head * 0.36}
          width={head * 0.28}
          height={head * 0.72}
          fill={FILL.paper}
          {...line}
          strokeWidth={2}
        />
      ))}
      {cells}
    </g>
  );
}

/** Bars rising with a big arrow, as on the dashboard. */
export function RisingChart({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const bars = [0.22, 0.36, 0.5, 0.68, 0.9];
  const bw = w / (bars.length * 1.6);
  return (
    <g>
      {bars.map((p, i) => {
        const bx = x + i * bw * 1.6 + bw * 0.3;
        const bh = h * p;
        return (
          <rect
            key={p}
            className="scene-bar"
            style={{ animationDelay: `${i * 0.15}s` }}
            x={bx}
            y={y + h - bh}
            width={bw}
            height={bh}
            fill={i === bars.length - 1 ? FILL.mid : FILL.light}
            {...line}
            strokeWidth={2}
          />
        );
      })}
      <path
        className="scene-arrow"
        d={`M${x} ${y + h * 0.9} C${x + w * 0.45} ${y + h * 0.85} ${x + w * 0.7} ${y + h * 0.5} ${x + w * 0.86} ${y + h * 0.08} L${x + w * 0.76} ${y + h * 0.1} L${x + w * 0.98} ${y - h * 0.16} L${x + w * 1.02} ${y + h * 0.18} L${x + w * 0.93} ${y + h * 0.12} C${x + w * 0.76} ${y + h * 0.6} ${x + w * 0.5} ${y + h * 0.96} ${x} ${y + h * 0.96} Z`}
        fill={FILL.mid}
        {...line}
      />
    </g>
  );
}

/** A round "bubble" holding a small picture, as in the flow scene. */
export function Bubble({
  cx,
  cy,
  r,
  children,
}: {
  cx: number;
  cy: number;
  r: number;
  children: ReactNode;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 5} fill={FILL.paper} stroke={FILL.light} strokeWidth={3} />
      <circle cx={cx} cy={cy} r={r} fill={FILL.soft} {...line} strokeWidth={2} />
      {children}
    </g>
  );
}
