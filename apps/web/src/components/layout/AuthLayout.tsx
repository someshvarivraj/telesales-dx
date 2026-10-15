import type { ReactNode } from 'react';
import { MoraBot, type MoraBotMood } from '@/components/brand/MoraBot';
import { LanguageSwitch } from '@/i18n/english/LanguageSwitch';
import { ja } from '@/i18n/ja';

interface AuthLayoutProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** MoraBot's expression, e.g. `trouble` after a failed login. */
  mood?: MoraBotMood;
}

/** Centered single-card layout for signed-out screens, as on the skill sheet system. */
export function AuthLayout({ title, children, footer, mood = 'default' }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-end">
          <LanguageSwitch />
        </div>
        <div className="mb-6 flex items-center justify-center gap-3">
          <MoraBot mood={mood} size={76} />
          <div>
            <p className="text-lg leading-tight font-bold text-ink">{ja.app.name}</p>
            <p className="text-xs text-ink-sub">{ja.app.company}</p>
          </div>
        </div>
        <main className="border border-line bg-surface px-7 py-8 shadow-(--shadow-card) max-sm:px-5 max-sm:py-6">
          <h1 className="mb-6 text-xl font-bold">{title}</h1>
          {children}
        </main>
        {footer && <div className="mt-5 text-center text-sm text-ink-sub">{footer}</div>}
        <p className="mt-5 text-center text-xs text-ink-sub">{ja.app.notice}</p>
      </div>
    </div>
  );
}
