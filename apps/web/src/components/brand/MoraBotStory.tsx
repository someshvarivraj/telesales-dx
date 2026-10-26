import { useEffect, useState } from 'react';
import { cn } from '@/components/ui/cn';
import { MoraBot, type MoraBotMood } from './MoraBot';

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
 * Hover or focus pauses it; clicking a step shows that step. No auto-play for
 * reduced motion.
 */
export function MoraBotStory({ steps }: { steps: StoryStep[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still] = useState(prefersStill);
  const playing = !paused && !still;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % steps.length), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [index, playing, steps.length]);

  const step = steps[index] ?? steps[0];
  if (!step) return null;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative h-56">
        <div className="absolute bottom-0 left-4">
          <div className="morabot-stage-glow" aria-hidden="true" />
          <MoraBot mood={step.mood} size={208} title="" />
        </div>
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
