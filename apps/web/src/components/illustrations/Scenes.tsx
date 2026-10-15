import { useId } from 'react';
import { cn } from '@/components/ui/cn';
import {
  Blob,
  Bubble,
  Bust,
  Calendar,
  Desk,
  FILL,
  INK,
  Limb,
  line,
  RisingChart,
  Sparkle,
} from './parts';

/*
 * Illustrations of the work the spec describes, one per step:
 *   CallingScene  — a telemarketer calling down the list (①架電)
 *   ScheduleScene — the appointment lands on the sales calendar (アポ・予定)
 *   MeetingScene  — the sales rep meets the customer (打ち合わせ)
 *   ReportScene   — results add up on the dashboard (結果・ダッシュボード)
 *   FlowScene     — the whole flow in one picture (sign-in screen)
 * They are decoration: hidden from screen readers unless a title is given.
 */

export type SceneName = 'calling' | 'schedule' | 'meeting' | 'report' | 'flow';

interface SceneProps {
  className?: string;
  /** Spoken name; leave empty for pure decoration. */
  title?: string;
}

function Frame({ className, title, children }: SceneProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 400 260"
      // Full width unless the caller sets a size.
      className={cn('block h-auto', className ?? 'w-full')}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title || undefined}
      data-no-translate
    >
      {children}
    </svg>
  );
}

/** A monitor with the call list; one row is the company being called now. */
function CallList({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x + 58} ${y + 96} L${x + 52} ${y + 118} M${x + 70} ${y + 96} L${x + 76} ${y + 118}`} {...line} />
      <rect x={x} y={y} width={128} height={96} fill={FILL.paper} {...line} />
      <rect x={x} y={y} width={128} height={14} fill={FILL.light} {...line} strokeWidth={2} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          {i === 1 && <rect x={x + 6} y={y + 34} width={116} height={14} fill={FILL.accentSoft} />}
          <circle cx={x + 14} cy={y + 27 + i * 18} r={3.5} fill={i === 1 ? FILL.accent : FILL.mid} />
          <path d={`M${x + 24} ${y + 27 + i * 18} L${x + (i === 1 ? 92 : 80 + i * 6)} ${y + 27 + i * 18}`} {...line} strokeWidth={2} />
        </g>
      ))}
    </g>
  );
}

/** Phone handset icon. */
function Handset({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M-10 -12 C-14 -8 -14 0 -6 8 C2 16 10 16 14 12 L14 7 L7 2 L3 6 C0 5 -5 0 -6 -3 L-2 -7 L-7 -14 Z"
      fill={FILL.deep}
      {...line}
      strokeWidth={2}
    />
  );
}

export function CallingScene(props: SceneProps) {
  return (
    <Frame {...props}>
      <Blob />
      <CallList x={212} y={74} />
      <Bust x={140} y={192} headset suit={FILL.deep} hair="long" />
      <Desk x1={40} x2={372} y={192} />
      {/* mug */}
      <path d="M340 172 L342 192 L362 192 L364 172 Z" fill={FILL.paper} {...line} strokeWidth={2} />
      <path d="M364 177 C372 177 372 187 363 187" fill="none" {...line} strokeWidth={2} />
      {/* call bubble */}
      <Bubble cx={84} cy={70} r={24}>
        <Handset x={84} y={70} />
      </Bubble>
      <path d="M108 84 L124 96" {...line} strokeWidth={2} strokeDasharray="2 6" />
      {/* sound waves */}
      <path d="M182 92 C188 98 188 106 182 112 M190 86 C200 96 200 108 190 118" fill="none" stroke={FILL.mid} strokeWidth={3} strokeLinecap="round" />
      <Sparkle x={356} y={60} />
      <Sparkle x={332} y={36} size={6} />
    </Frame>
  );
}

export function ScheduleScene(props: SceneProps) {
  return (
    <Frame {...props}>
      <Blob />
      <Calendar x={104} y={46} w={196} h={168} done={[3, 1]} />
      {/* clock */}
      <circle cx={300} cy={198} r={30} fill={FILL.paper} {...line} />
      <path d="M300 180 L300 198 L314 206" fill="none" {...line} strokeWidth={3} />
      {/* pin dropping onto the booked day */}
      <path d="M244 18 C232 18 226 28 230 38 L244 60 L258 38 C262 28 256 18 244 18 Z" fill={FILL.accent} {...line} />
      <circle cx={244} cy={33} r={5} fill={FILL.paper} {...line} strokeWidth={2} />
      {/* rep figure beside the calendar */}
      <Bust x={78} y={236} suit={FILL.mid} raise scale={0.8} />
      <Sparkle x={340} y={66} />
      <Sparkle x={70} y={52} size={7} />
    </Frame>
  );
}

export function MeetingScene(props: SceneProps) {
  return (
    <Frame {...props}>
      <Blob />
      {/* customer's building behind */}
      <g>
        <rect x={160} y={40} width={86} height={150} fill={FILL.light} {...line} />
        {[0, 1, 2, 3, 4].map((r) =>
          [0, 1, 2].map((c) => (
            <rect key={`${r}-${c}`} x={172 + c * 24} y={54 + r * 24} width={14} height={12} fill={FILL.paper} {...line} strokeWidth={1.5} />
          )),
        )}
      </g>
      <Bust x={118} y={194} facing={1} suit={FILL.deep} />
      <Bust x={290} y={194} facing={-1} suit={FILL.mid} hair="long" />
      <Desk x1={50} x2={360} y={194} />
      {/* laptop */}
      <path d="M180 192 L186 160 L228 160 L232 192 Z" fill={FILL.paper} {...line} />
      <path d="M170 194 L242 194" {...line} strokeWidth={4} />
      {/* agreement bubble */}
      <g>
        <rect x={186} y={8} width={44} height={30} fill={FILL.paper} {...line} />
        <path d="M200 38 L204 46 L210 38" fill={FILL.paper} {...line} />
        <circle cx={208} cy={23} r={9} fill={FILL.accent} />
        <path d="M203 23 L207 27 L213 19" fill="none" stroke={FILL.paper} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <Sparkle x={58} y={62} />
      <Sparkle x={350} y={52} size={7} />
    </Frame>
  );
}

export function ReportScene(props: SceneProps) {
  return (
    <Frame {...props}>
      <Blob />
      <rect x={92} y={50} width={220} height={150} fill={FILL.paper} {...line} />
      <path d="M108 66 L170 66 M108 78 L146 78" {...line} strokeWidth={2} />
      <RisingChart x={112} y={96} w={180} h={96} />
      <path d="M192 200 L184 228 M212 200 L220 228 M172 228 L232 228" {...line} />
      <Bust x={66} y={250} suit={FILL.deep} raise scale={0.78} />
      <Sparkle x={334} y={40} />
      <Sparkle x={352} y={70} size={6} />
      <Sparkle x={300} y={24} size={6} />
    </Frame>
  );
}

/** The flow on the sign-in screen: call → appointment → meeting, results rising. */
export function FlowScene(props: SceneProps) {
  const id = useId().replace(/:/g, '');
  const clip = (name: string) => `${id}-${name}`;
  return (
    <Frame {...props}>
      <Blob d="M30 176 C18 112 64 56 136 50 C210 44 240 78 300 64 C362 50 392 108 378 160 C366 212 300 236 214 234 C126 232 44 232 30 176 Z" />
      {/* dashed path linking the steps */}
      <path d="M76 168 C110 120 150 110 196 116 C246 122 276 100 320 72" fill="none" stroke={INK} strokeWidth={2} strokeDasharray="3 7" strokeLinecap="round" />

      <defs>
        {(
          [
            ['call', 76, 168],
            ['plan', 196, 116],
            ['meet', 318, 76],
          ] as const
        ).map(([name, cx, cy]) => (
          <clipPath key={name} id={clip(name)}>
            <circle cx={cx} cy={cy} r={36} />
          </clipPath>
        ))}
      </defs>

      <Bubble cx={76} cy={168} r={36}>
        <g clipPath={`url(#${clip('call')})`}>
          <Bust x={76} y={208} headset hair="long" scale={0.55} />
        </g>
      </Bubble>
      <Bubble cx={196} cy={116} r={36}>
        <g clipPath={`url(#${clip('plan')})`}>
          <Calendar x={168} y={94} w={56} h={48} done={[2, 1]} />
        </g>
      </Bubble>
      <Bubble cx={318} cy={76} r={36}>
        <g clipPath={`url(#${clip('meet')})`}>
          <Bust x={302} y={112} scale={0.45} />
          <Bust x={336} y={112} facing={-1} suit={FILL.mid} hair="long" scale={0.45} />
        </g>
      </Bubble>

      {/* results: bars and the arrow under the steps */}
      <g opacity={0.95}>
        <RisingChart x={196} y={176} w={150} h={52} />
      </g>
      <Limb d="M40 236 L372 236" color={FILL.light} width={2} />
      <Sparkle x={366} y={30} />
      <Sparkle x={140} y={70} size={7} />
      <Sparkle x={258} y={60} size={6} />
    </Frame>
  );
}

const SCENES: Record<SceneName, (props: SceneProps) => React.ReactElement> = {
  calling: CallingScene,
  schedule: ScheduleScene,
  meeting: MeetingScene,
  report: ReportScene,
  flow: FlowScene,
};

export function Scene({ name, ...props }: SceneProps & { name: SceneName }) {
  const Component = SCENES[name];
  return <Component {...props} />;
}
