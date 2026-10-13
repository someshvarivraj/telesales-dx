import type { ReactNode } from 'react';
import { ja } from '@/i18n/ja';
import { BrandMark } from './BrandMark';

interface AuthLayoutProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Centered single-card layout for signed-out screens. */
export function AuthLayout({ title, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 flex items-center gap-2.5">
        <BrandMark />
        <span className="text-lg font-bold tracking-wide text-ink">{ja.app.name}</span>
      </div>
      <main className="w-full max-w-[400px] rounded-(--radius-card) border border-line bg-surface p-8 shadow-(--shadow-card) max-sm:p-6">
        <h1 className="mb-6 text-xl font-bold">{title}</h1>
        {children}
      </main>
      {footer && (
        <div className="mt-6 max-w-[400px] text-center text-sm text-ink-sub">{footer}</div>
      )}
    </div>
  );
}
