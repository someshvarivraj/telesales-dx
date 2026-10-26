import type { ReactNode } from 'react';
import { MoraBot, type MoraBotMood } from '@/components/brand/MoraBot';
import { Scene, type SceneName } from '@/components/illustrations/Scenes';

interface EmptyStateProps {
  children: ReactNode;
  /** MoraBot guides by default; `think` for no search results. */
  mood?: MoraBotMood;
  /** Small icon instead of MoraBot, for tight spaces. */
  icon?: ReactNode;
  /** An illustration of the step that has not happened yet (no calls, no results…). */
  scene?: SceneName;
}

export function EmptyState({ children, mood = 'guide', icon, scene }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-ink-sub">
      {icon ? (
        <div className="text-ink-disabled">{icon}</div>
      ) : scene ? (
        <Scene name={scene} className="w-56 max-w-full" />
      ) : (
        <MoraBot mood={mood} size={104} title="" />
      )}
      <div>{children}</div>
    </div>
  );
}
