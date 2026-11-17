import { Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/components/ui/cn';
import type { MoraBotMood } from './MoraBot';
import { ART, ART_RATIO, poseUrl } from './morabotArt';
import { PokeEffects, usePoke } from './morabotPoke';
import { type Theme, useTheme } from './theme';

export interface StoryStep {
  title: string;
  /** What MoraBot says while this step is shown. */
  line: string;
  mood: MoraBotMood;
  /** Who acts this step: the girl MoraBot (telemarketing) or the blue one (sales). Default: the page's theme. */
  look?: Theme;
}

const STEP_MS = 3200;

function prefersStill() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/**
 * MoraBot acting out the work, one step after another: the pose changes and a speech
 * bubble says what happened. The list of steps under it was removed on 11/17 to keep the
 * sign-in screen simple. All poses are loaded once and stacked, so a change is only a fade
 * and a hop — no new image to fetch or decode mid-animation. The pause button stops it.
 * No auto-play for reduced motion.
 */
export function MoraBotStory({ steps }: { steps: StoryStep[] }) {
  const [index, setIndex] = useState(0);
  const { theme } = useTheme();
  const [still] = useState(prefersStill);
  const [paused, setPaused] = useState(still);
  // Click MoraBot for a reaction; the story waits while it plays.
  const { reaction, poke } = usePoke();
  const playing = !paused && !reaction;
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
            className={cn(
              'morabot morabot-art morabot-pokable',
              !still && 'morabot-art-idle',
              reaction && `morabot-poke-${reaction.kind}`,
            )}
            style={{ width, height: size }}
            onClick={poke}
          >
            <span className="morabot-shadow" />
            <span className="morabot-body">
              {steps.map((item, i) => {
                const file = ART[item.mood];
                return (
                  file && (
                    <img
                      key={item.title}
                      src={poseUrl(file, item.look ?? theme)}
                      width={width}
                      height={size}
                      alt=""
                      decoding="sync"
                      draggable={false}
                      className={cn(
                        'morabot-pose morabot-stack',
                        i === index && 'morabot-stack-on morabot-react',
                      )}
                    />
                  )
                );
              })}
              {reaction?.kind === 'split' && ART[step.mood] && (
                <span className="morabot-split">
                  {(['top', 'bottom'] as const).map((half) => (
                    <img
                      key={half}
                      src={poseUrl(ART[step.mood] ?? '', step.look ?? theme)}
                      alt=""
                      draggable={false}
                      className={`morabot-pose morabot-half-${half}`}
                    />
                  ))}
                </span>
              )}
            </span>
            {reaction && <PokeEffects reaction={reaction} size={size} bubble={false} />}
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
          key={reaction ? `poke-${reaction.id}` : index}
          aria-live="polite"
          className="morabot-bubble absolute top-6 left-[11.5rem] border border-line bg-surface px-3 py-2 text-sm font-bold whitespace-nowrap text-ink shadow-(--shadow-raised)"
        >
          {reaction?.line ?? step.line}
        </p>
      </div>
    </div>
  );
}
