import { Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/components/ui/cn';
import type { MoraBotMood } from './MoraBot';
import { ART, ART_RATIO, poseUrl } from './morabotArt';

export interface StoryStep {
  title: string;
  text: string;
  /** What MoraBot says while this step is shown. */
  line: string;
  mood: MoraBotMood;
}

const STEP_MS = 3200;

function prefersStill() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/**
 * MoraBot acting out the work, one step after another: the pose changes, a speech
 * bubble says what happened and the matching step lights up with a filling bar.
 * All poses are loaded once and stacked, so a change is only a fade and a hop — no
 * new image to fetch or decode mid-animation. Clicking a step shows it (the timer
 * restarts from there); the pause button stops it. No auto-play for reduced motion.
 */
export function MoraBotStory({ steps }: { steps: StoryStep[] }) {
  const [index, setIndex] = useState(0);
  const [still] = useState(prefersStill);
  const [paused, setPaused] = useState(still);
  const playing = !paused;
  const size = 208;
  const width = Math.round(size * ART_RATIO);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % steps.length), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [index, playing, steps.length]);

  const step = steps[index] ?? steps[0];
  if (!step) return null;

  return (
    <div>
      <div className="relative h-56">
        <div className="absolute bottom-0 left-4">
          <div className="morabot-stage-glow" aria-hidden="true" />
          <span
            aria-hidden="true"
            className={cn('morabot morabot-art', !still && 'morabot-art-idle')}
            style={{ width, height: size }}
          >
            <span className="morabot-shadow" />
            <span className="morabot-body">
              {steps.map((item, i) => {
                const file = ART[item.mood];
                return (
                  file && (
                    <img
                      key={item.title}
                      src={poseUrl(file)}
                      width={width}
                      height={size}
                      alt=""
                      decoding="sync"
                      draggable={false}
                      className={cn(
                        'morabot-pose morabot-stack',
                        i === index && 'morabot-stack-on',
                      )}
                    />
                  )
                );
              })}
            </span>
          </span>
        </div>
        {!still && (
          <button
            type="button"
            onClick={() => setPaused(!paused)}
            aria-label={paused ? '動きを再開' : '動きを止める'}
            className="absolute bottom-1 left-0 flex size-7 cursor-pointer items-center justify-center text-ink-sub hover:bg-surface hover:text-ink"
          >
            {paused ? (
              <Play aria-hidden="true" className="size-3.5" />
            ) : (
              <Pause aria-hidden="true" className="size-3.5" />
            )}
          </button>
        )}
        <p
          key={index}
          aria-live="polite"
          className="morabot-bubble absolute top-6 left-[11.5rem] border border-line bg-surface px-3 py-2 text-sm font-bold whitespace-nowrap text-ink shadow-(--shadow-raised)"
        >
          {step.line}
        </p>
      </div>

      <ol className="mt-6 flex flex-col gap-1.5">
        {steps.map((item, i) => {
          const on = i === index;
          return (
            <li key={item.title}>
              <button
                type="button"
                aria-current={on ? 'step' : undefined}
                onClick={() => setIndex(i)}
                className={cn(
                  'relative flex w-full cursor-pointer items-start gap-3 overflow-hidden border-l-4 px-3 py-2 text-left transition-colors',
                  on ? 'border-main bg-surface' : 'border-transparent hover:bg-surface/60',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full! text-xs font-bold transition-colors',
                    on ? 'bg-main text-white' : 'bg-line text-ink-sub',
                  )}
                >
                  {i + 1}
                </span>
                <span className="text-sm">
                  <span className={cn('font-bold', on ? 'text-ink' : 'text-ink-sub')}>
                    {item.title}
                  </span>
                  <span className="block text-ink-sub">{item.text}</span>
                </span>
                {on && (
                  <span
                    key={index}
                    aria-hidden="true"
                    className="morabot-step-timer absolute bottom-0 left-0 h-0.5 bg-main"
                    style={{
                      animationDuration: `${STEP_MS}ms`,
                      animationPlayState: playing ? 'running' : 'paused',
                    }}
                  />
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
