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
 * Signed-out screens: the form card, and on wide screens the app's flow beside it.
 * Phones and tablets get the card alone so the form is the first thing on screen.
 */
export function AuthLayout({ title, children, footer, mood = 'default' }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <GridBackdrop />
      <div className="flex w-full max-w-5xl items-center justify-center gap-14">
        <section className="max-w-md flex-1 max-lg:hidden">
          <FlowScene />
          <p className="mt-6 text-2xl leading-snug font-bold text-ink">
            架電からアポ、打ち合わせの結果まで。
          </p>
          <p className="mt-1 text-sm text-ink-sub">テレマと営業が、同じ情報で動けます。</p>
          <ol className="mt-6 flex flex-col gap-3">
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
        </section>

        <div className="w-full max-w-md">
          <div className="mb-4 flex justify-end">
            <LanguageSwitch className="w-36" />
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
    </div>
  );
}
