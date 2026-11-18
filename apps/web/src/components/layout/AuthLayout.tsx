import type { ReactNode } from 'react';
import { GridBackdrop } from '@/components/brand/GridBackdrop';
import { MoraBot, type MoraBotMood } from '@/components/brand/MoraBot';
import { MoraBotPeek } from '@/components/brand/MoraBotPeek';
import { FallingLeaves } from '@/components/brand/FallingLeaves';
import { isOnMoon } from '../../../outage/leaves.js';
import { LastThemeProvider } from '@/components/brand/theme';
import { LanguageMenu } from './TopBarMenus';
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
        <div className="absolute top-4 right-4 z-10">
          <LanguageMenu floating />
        </div>

        <div
          data-scene
          className={cn(
            'relative z-10 flex w-full items-center justify-center',
            // With the lake (11/17): one centred column, the headline over the sign-in box, so
            // the scene frames it evenly (moon and Fuji on the left, Kobe's waterfront on the right)
            // and MoraBot peeks out from behind Fuji clear of both.
            leaves ? 'max-w-[540px] flex-col gap-6' : 'max-w-[960px] gap-16',
          )}
        >
          <section
            data-scene
            className={cn(
              leaves ? 'w-full text-center max-sm:hidden' : 'max-w-md flex-1 max-lg:hidden',
            )}
          >
            <p
              className={cn(
                'leading-snug font-bold text-ink',
                leaves ? 'text-[1.6rem] [text-shadow:0_1px_12px_rgb(255_255_255/0.7)]' : 'text-2xl',
              )}
            >
              架電からアポ、打ち合わせの結果まで。
            </p>
            <p className={cn('mt-1 text-sm text-ink-sub', !leaves && 'mb-4')}>
              テレマと営業が、同じ情報で動けます。
            </p>
            {!leaves && <MoraBot mood="happy" size={180} title="" className="mt-6" />}
          </section>

          <div
            className={cn(
              'w-full max-w-[420px] shrink-0',
              // Over the lake (11/18): a glassmorphism pane (see .glass-card), the scene showing
              // through behind a blur, the text as easy to read as on white.
              leaves
                ? 'glass-card'
                : 'border border-t-4 border-line border-t-main bg-surface shadow-(--shadow-raised)',
            )}
          >
            <header
              className={cn(
                'flex items-center gap-3 border-b px-6 py-4 max-sm:px-5',
                leaves ? 'border-white/40' : 'border-line',
              )}
            >
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

            <footer
              className={cn(
                'flex flex-col gap-1 border-t px-6 py-3 text-xs text-ink-sub max-sm:px-5',
                leaves ? 'border-white/40' : 'border-line bg-column',
              )}
            >
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
