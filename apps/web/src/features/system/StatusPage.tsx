import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { ja } from '@/i18n/ja';

interface StatusPageProps {
  title: string;
  description?: string;
  icon?: ReactNode;
}

/** Shared layout for empty / error states. */
export function StatusPage({ title, description, icon }: StatusPageProps) {
  return (
    <section className="flex flex-col items-center px-4 py-20 text-center">
      {icon && <div className="mb-4 text-ink-sub">{icon}</div>}
      <h1 className="text-xl font-bold">{title}</h1>
      {description && <p className="mt-2 text-ink-sub">{description}</p>}
      <Link
        to={paths.root}
        className="mt-8 rounded-(--radius-control) border border-line bg-surface px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-column"
      >
        {ja.common.backToHome}
      </Link>
    </section>
  );
}
