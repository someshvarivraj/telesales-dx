import type { ReactNode } from 'react';
import { MoraBot, type MoraBotMood } from '@/components/brand/MoraBot';

interface EmptyStateProps {
  children: ReactNode;
  /** MoraBot explains by default; `think` for no search results. */
  mood?: MoraBotMood;
  /** Small icon instead of MoraBot, for tight spaces. */
  icon?: ReactNode;
}

export function EmptyState({ children, mood = 'explain', icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-ink-sub">
      {icon ? (
        <div className="text-ink-disabled">{icon}</div>
      ) : (
        <MoraBot mood={mood} size={72} title="" />
      )}
      <div>{children}</div>
    </div>
  );
}
