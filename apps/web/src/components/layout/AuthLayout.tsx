import type { ReactNode } from 'react';
import { GridBackdrop } from '@/components/brand/GridBackdrop';
import { MoraBot, type MoraBotMood } from '@/components/brand/MoraBot';
import { FlowScene } from '@/components/illustrations/Scenes';
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
const STEPS = [
  { title: '架電', text: 'リストから電話をかけ、結果を記録' },
  { title: 'アポ', text: '営業の空き枠を押さえて登録、すぐ共有' },
  { title: '打ち合わせ・結果', text: '準備・結果・次回アクションまで一か所に' },
];

/**
 * Signed-out screens, in the classic split layout: the app's flow on the grid at the
 * left, and a plain white form panel at the right (full height, no floating card).
 * Phones and tablets get the form panel alone so the form is the first thing on screen.
 */
export function AuthLayout({ title, children, footer, mood = 'default' }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh">
      <GridBackdrop />

      <section className="flex flex-1 flex-col justify-center px-14 py-12 max-lg:hidden">
        <div className="mx-auto w-full max-w-lg">
          <FlowScene />
          <p className="mt-8 text-[28px] leading-snug font-bold text-ink">
            架電からアポ、打ち合わせの結果まで。
          </p>
          <p className="mt-2 text-base text-ink-sub">テレマと営業が、同じ情報で動けます。</p>
          <ol className="mt-8 flex flex-col gap-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full! bg-main text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span className="text-sm">
                  <span className="font-bold text-ink">{step.title}</span>
                  <span className="block text-ink-sub">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="flex w-full shrink-0 flex-col border-l border-line bg-surface shadow-(--shadow-raised) lg:w-[480px]">
        <div className="flex items-center justify-between gap-3 px-8 pt-6 max-sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <MoraBot mood={mood} size={40} title="" />
            <div className="min-w-0">
              <p className="truncate text-[15px] leading-tight font-bold text-ink">{ja.app.name}</p>
              <p className="truncate text-[11px] leading-tight text-ink-sub">{ja.app.company}</p>
            </div>
          </div>
          <LanguageSwitch className="w-32 shrink-0" />
        </div>

        <main className="flex flex-1 flex-col justify-center px-12 py-10 max-sm:px-5">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="text-2xl font-bold text-ink">{title}</h1>
            <div className="mt-2 mb-8 h-[3px] w-10 bg-main" aria-hidden="true" />
            {children}
            {footer && <p className="mt-6 text-sm text-ink-sub">{footer}</p>}
          </div>
        </main>

        <p className="border-t border-line px-8 py-4 text-xs text-ink-sub max-sm:px-5">
          {ja.app.notice}
        </p>
      </div>
    </div>
  );
}
