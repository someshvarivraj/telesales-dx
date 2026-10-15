import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/**
 * モラボット — the company mascot, shared with the skill sheet system.
 *
 * Drawn as inline SVG so it stays sharp at any size; each mood is a different
 * face on the same body:
 *
 *   default  にっこり   — logo, greetings
 *   happy    喜ぶ       — something finished
 *   trouble  困る       — an error, a page that does not exist
 *   think    考える     — loading, no search results
 *   explain  説明する   — empty screens and guidance
 *
 * Three poses are Sano-san's own artwork, used as images so the details stay
 * exactly as drawn: approved（できた）, checking（確認中）, writing（作成中）.
 */
export type MoraBotMood =
  'default' | 'happy' | 'trouble' | 'think' | 'explain' | 'approved' | 'checking' | 'writing';

const C = {
  blue: '#2150B8',
  navy: '#0B2A6B',
  orange: '#FF9A33',
  green: '#148A0B',
  arm: '#4B78D6',
  bubble: '#8FB0EA',
  white: '#FFFFFF',
};

const LABELS: Record<MoraBotMood, string> = {
  default: 'モラボット',
  happy: 'モラボット（喜ぶ）',
  trouble: 'モラボット（困る）',
  think: 'モラボット（考える）',
  explain: 'モラボット（説明する）',
  approved: 'モラボット（できた）',
  checking: 'モラボット（確認中）',
  writing: 'モラボット（作成中）',
};

/** Artwork poses: file and width/height ratio. */
const ART: Partial<Record<MoraBotMood, { file: string; ratio: number }>> = {
  approved: { file: 'morabot/approved.png', ratio: 473 / 480 },
  checking: { file: 'morabot/checking.png', ratio: 501 / 480 },
  writing: { file: 'morabot/writing.png', ratio: 429 / 480 },
};

function RingEyes({ look = [0, 0], small = false }: { look?: [number, number]; small?: boolean }) {
  const r = small ? 62 : 75;
  return (
    <>
      {[600, 840].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={606} r={r} fill={C.blue} />
          <circle cx={cx} cy={606} r={r - 30} fill={C.white} />
          <circle cx={cx + look[0]} cy={606 + look[1]} r={15} fill={C.navy} />
        </g>
      ))}
    </>
  );
}

function Cheeks() {
  return (
    <>
      <circle cx={510} cy={708} r={30} fill={C.orange} />
      <circle cx={930} cy={708} r={30} fill={C.orange} />
    </>
  );
}

const stroke = { fill: 'none', stroke: C.blue, strokeWidth: 16, strokeLinecap: 'round' as const };

function Face({ mood }: { mood: MoraBotMood }) {
  switch (mood) {
    case 'happy':
      return (
        <>
          <path d="M540 625 Q600 560 660 625" {...stroke} strokeWidth={22} />
          <path d="M780 625 Q840 560 900 625" {...stroke} strokeWidth={22} />
          <path d="M630 685 Q720 770 810 685" {...stroke} />
          <Cheeks />
        </>
      );
    case 'trouble':
      return (
        <>
          <RingEyes small look={[0, 6]} />
          <path d="M535 520 L655 548" {...stroke} stroke={C.navy} strokeWidth={14} />
          <path d="M785 548 L905 520" {...stroke} stroke={C.navy} strokeWidth={14} />
          <path d="M670 728 Q720 695 770 728" {...stroke} stroke={C.navy} strokeWidth={12} />
          <path d="M945 560 Q965 600 945 615 Q925 600 945 560 Z" fill={C.bubble} />
        </>
      );
    case 'think':
      return (
        <>
          <RingEyes look={[18, -18]} />
          <path d="M700 718 L740 718" {...stroke} stroke={C.navy} strokeWidth={12} />
        </>
      );
    case 'explain':
      return (
        <>
          <RingEyes />
          <ellipse cx={720} cy={712} rx={24} ry={18} fill={C.navy} />
          <Cheeks />
        </>
      );
    default:
      return (
        <>
          <RingEyes />
          <path d="M658 694 Q720 740 782 694" {...stroke} strokeWidth={14} />
          <Cheeks />
        </>
      );
  }
}

interface MoraBotProps {
  mood?: MoraBotMood;
  /** Height in px. */
  size?: number;
  className?: string;
  /** A gentle bob, for a MoraBot that is busy. */
  animate?: boolean;
  /** Just the head, for small marks such as the logo. */
  headOnly?: boolean;
  /** Accessible name; defaults to the mood's name. Pass '' for decoration. */
  title?: string;
}

export function MoraBot({
  mood = 'default',
  size = 96,
  className,
  animate = false,
  headOnly = false,
  title,
}: MoraBotProps) {
  const label = title ?? LABELS[mood];
  const classes = cn('morabot', animate && 'morabot-busy', `morabot-${mood}`, className);

  const art = headOnly ? undefined : ART[mood];
  if (art) {
    const width = Math.round(size * art.ratio);
    return (
      <img
        src={`${import.meta.env.BASE_URL}${art.file}`}
        width={width}
        height={size}
        style={{ width, height: size, objectFit: 'contain' }}
        alt={label}
        aria-hidden={label ? undefined : true}
        className={classes}
        draggable={false}
      />
    );
  }

  const viewBox = headOnly ? '320 210 800 700' : '300 190 840 1000';
  const [, , w = 1, h = 1] = viewBox.split(' ').map(Number);

  return (
    <svg
      viewBox={viewBox}
      height={size}
      width={(size * w) / h}
      className={classes}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      {mood === 'think' && (
        <g className="morabot-bubbles" fill={C.bubble}>
          <circle cx={1010} cy={390} r={16} />
          <circle cx={1050} cy={340} r={24} />
          <circle cx={1095} cy={280} r={32} />
        </g>
      )}
      <rect x={711} y={290} width={18} height={90} fill={C.navy} />
      <circle className="morabot-antenna" cx={720} cy={263} r={42} fill={C.orange} />
      <rect x={330} y={540} width={60} height={144} rx={26} fill={C.orange} />
      <rect x={1050} y={540} width={60} height={144} rx={26} fill={C.orange} />
      <rect x={390} y={372} width={660} height={528} rx={150} fill={C.blue} />
      <rect x={462} y={456} width={516} height={300} rx={110} fill={C.white} />
      <Face mood={mood} />
      {!headOnly && (
        <>
          <ellipse cx={462} cy={1008} rx={48} ry={84} fill={C.arm} />
          <ellipse cx={978} cy={1008} rx={48} ry={84} fill={C.arm} />
          <rect x={540} y={912} width={360} height={204} rx={100} fill={C.green} />
          <circle cx={720} cy={1014} r={48} fill="none" stroke={C.white} strokeWidth={9} />
          <rect x={600} y={1116} width={96} height={48} rx={20} fill={C.navy} />
          <rect x={744} y={1116} width={96} height={48} rx={20} fill={C.navy} />
        </>
      )}
    </svg>
  );
}

/**
 * A progress bar MoraBot rides along. With `percent` MoraBot stands at the tip
 * of the filled part; without it (amount of work unknown) MoraBot walks to and fro.
 */
export function MoraBotProgress({ percent, label }: { percent?: number; label?: ReactNode }) {
  const known = typeof percent === 'number';
  const p = known ? Math.max(0, Math.min(100, percent)) : 0;
  return (
    <div
      className="w-full"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={known ? Math.round(p) : undefined}
      aria-label={typeof label === 'string' ? label : '処理中'}
    >
      {label && <p className="mb-1 text-sm font-bold text-ink">{label}</p>}
      <div className="morabot-track">
        <div className="morabot-bar">
          <div
            className={cn('morabot-fill', !known && 'morabot-fill-indeterminate')}
            style={known ? { width: `${p}%` } : undefined}
          />
        </div>
        <div
          className={cn('morabot-rider', !known && 'morabot-rider-indeterminate')}
          style={known ? { left: `${p}%` } : undefined}
        >
          <MoraBot
            mood={known && p >= 100 ? 'approved' : 'writing'}
            size={40}
            animate={!known || p < 100}
            title=""
          />
        </div>
      </div>
    </div>
  );
}
