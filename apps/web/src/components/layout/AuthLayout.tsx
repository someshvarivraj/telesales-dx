import type { ReactNode } from 'react';
import { GridBackdrop } from '@/components/brand/GridBackdrop';
import { MoraBot, type MoraBotMood } from '@/components/brand/MoraBot';
import { MoraBotPeek } from '@/components/brand/MoraBotPeek';
import { FallingLeaves } from '@/components/brand/FallingLeaves';
import { isOnMoon } from '../../../outage/leaves.js';
import { LastThemeProvider } from '@/components/brand/theme';
import { LanguageSwitch } from '@/i18n/english/LanguageSwitch';
import { cn } from '@/components/ui/cn';
import { ja } from '@/i18n/ja';

interface AuthLayoutProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** MoraBot's expression, e.g. `trouble` after a failed login. */
  mood?: MoraBotMood;
  /** Red leaves falling onto a lake behind the page (requests 11/12, 11/13: sign-in only). */
  leaves?: boolean;
}

/**
 * Signed-out screens: the headline and a compact sign-in box side by side in the middle.
 * On the sign-in screen MoraBot plays hide-and-seek behind Mt. Fuji (11/17); elsewhere it
 * stands under the headline.
 * The box is classic: accent bar on top, the brand as its header, the form, and the
 * notes in a grey foot. Phones and tablets show the box alone.
 */
export function AuthLayout({
  title,
  children,
  footer,
  mood = 'default',
  leaves = false,
}: AuthLayoutProps) {
  return (
    <LastThemeProvider>
      <div data-scene className="relative flex min-h-dvh items-center justify-center px-4 py-16">
        {/* Leaves fall behind the sign-in box onto a lake under an evening sky (11/13). No grid
            here: only its click ripple, over the sky, fading out above the mountains. */}
        {leaves && <FallingLeaves className="z-0" lake />}
        {leaves ? (
          <GridBackdrop
            lines={false}
            skipClick={(x, y) =>
              isOnMoon(x, y, window.innerWidth) ||
              (typeof document.elementFromPoint === 'function' &&
                Boolean(document.elementFromPoint(x, y)?.closest('[data-peek]')))
            }
            className="z-0 [mask-image:linear-gradient(to_bottom,black_45%,transparent_62%)]"
          />
        ) : (
          <GridBackdrop />
        )}
        {leaves && <MoraBotPeek />}
        <LanguageSwitch className="absolute top-4 right-4 z-10 w-32" />

        <div
          data-scene
          className="relative z-10 flex w-full max-w-[960px] items-center justify-center gap-16"
        >
          {/* With the lake, the headline sits at the top so MoraBot can peek out from behind
              Fuji below it. */}
          <section
            data-scene
            className={cn('max-w-md flex-1 max-lg:hidden', leaves && 'self-start')}
          >
            <p className="text-2xl leading-snug font-bold text-ink">
              架電からアポ、打ち合わせの結果まで。
            </p>
            <p className="mt-1 mb-4 text-sm text-ink-sub">テレマと営業が、同じ情報で動けます。</p>
            {!leaves && <MoraBot mood="happy" size={180} title="" className="mt-6" />}
          </section>

          <div className="w-full max-w-[420px] shrink-0 border border-t-4 border-line border-t-main bg-surface shadow-(--shadow-raised)">
            <header className="flex items-center gap-3 border-b border-line px-6 py-4 max-sm:px-5">
              <MoraBot mood={mood} size={56} title="" />
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
      </div>
    </LastThemeProvider>
  );
}
