import type { ReactNode } from 'react';
import { GridBackdrop } from '@/components/brand/GridBackdrop';
import { MoraBot, type MoraBotMood } from '@/components/brand/MoraBot';
import { MoraBotStory, type StoryStep } from '@/components/brand/MoraBotStory';
import { LanguageSwitch } from '@/i18n/english/LanguageSwitch';
import { ja } from '@/i18n/ja';

interface AuthLayoutProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** MoraBot's expression, e.g. `trouble` after a failed login. */
  mood?: MoraBotMood;
}

/** The work the app covers, in the spec's order (架電 → アポ → 打ち合わせ・結果). */
const STEPS: StoryStep[] = [
  {
    title: '架電',
    text: 'リストから電話をかけ、結果を記録',
    line: '架電の結果、記録しました！',
    mood: 'callHappy',
  },
  {
    title: 'アポ',
    text: '営業の空き枠を押さえて登録、すぐ共有',
    line: 'アポ確定、営業に共有しました！',
    mood: 'booked',
  },
  {
    title: '打ち合わせ・結果',
    text: '準備・結果・次回アクションまで一か所に',
    line: '結果まで入力済みです！',
    mood: 'done',
  },
];

/**
 * Signed-out screens: the app's flow (MoraBot acting out three steps) and a compact sign-in
 * box side by side in the middle of the grid — one group, the page is not divided.
 * The box is classic: accent bar on top, the brand as its header, the form, and the
 * notes in a grey foot. Phones and tablets show the box alone.
 */
export function AuthLayout({ title, children, footer, mood = 'default' }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-16">
      <GridBackdrop />
      <LanguageSwitch className="absolute top-4 right-4 w-32" />

      <div className="flex w-full max-w-[960px] items-center justify-center gap-16">
        <section className="max-w-md flex-1 max-lg:hidden">
          <p className="text-2xl leading-snug font-bold text-ink">
            架電からアポ、打ち合わせの結果まで。
          </p>
          <p className="mt-1 mb-4 text-sm text-ink-sub">テレマと営業が、同じ情報で動けます。</p>
          <MoraBotStory steps={STEPS} />
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
  );
}
