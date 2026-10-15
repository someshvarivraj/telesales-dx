import type { ReactNode } from 'react';
import { GridBackdrop } from '@/components/brand/GridBackdrop';
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

/**
 * Signed-out screens: one compact box in the middle of the grid, in the classic style —
 * an accent bar on top, the brand as the box header, the form, and the notes in a
 * grey foot. The language switch sits in the page corner.
 */
export function AuthLayout({ title, children, footer, mood = 'default' }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-16">
      <GridBackdrop />
      <LanguageSwitch className="absolute top-4 right-4 w-32" />

      <div className="w-full max-w-[420px] border border-t-4 border-line border-t-main bg-surface shadow-(--shadow-raised)">
        <header className="flex items-center gap-3 border-b border-line px-6 py-4 max-sm:px-5">
          <MoraBot mood={mood} size={40} title="" />
          <div className="min-w-0">
            <p className="truncate text-base leading-tight font-bold text-ink">{ja.app.name}</p>
            <p className="truncate text-[11px] leading-tight text-ink-sub">{ja.app.company}</p>
          </div>
        </header>

        <main className="px-6 pt-5 pb-6 max-sm:px-5">
          <h1 className="mb-5 text-lg font-bold">{title}</h1>
          {children}
        </main>

        <footer className="flex flex-col gap-1 border-t border-line bg-column px-6 py-3 text-xs text-ink-sub max-sm:px-5">
          {footer && <p>{footer}</p>}
          {/* One sentence per line, so no line ends with a stray 「さい。」. */}
          {ja.app.notice
            .split('。')
            .filter(Boolean)
            .map((sentence) => (
              <p key={sentence}>{sentence}。</p>
            ))}
        </footer>
      </div>
    </div>
  );
}
