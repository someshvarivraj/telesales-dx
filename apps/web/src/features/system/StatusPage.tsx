import { Link } from 'react-router';
import { MoraBot, type MoraBotMood } from '@/components/brand/MoraBot';
import { paths } from '@/app/paths';
import { ja } from '@/i18n/ja';

interface StatusPageProps {
  title: string;
  description?: string;
  /** MoraBot's expression; `trouble` for errors and missing pages. */
  mood?: MoraBotMood;
}

/** Shared layout for empty / error states. */
export function StatusPage({ title, description, mood = 'trouble' }: StatusPageProps) {
  return (
    <section className="flex flex-col items-center px-4 py-16 text-center">
      <MoraBot mood={mood} size={140} className="mb-6" title="" />
      <h1 className="text-xl font-bold">{title}</h1>
      {description && <p className="mt-2 text-ink-sub">{description}</p>}
      <Link
        to={paths.root}
        className="mt-8 border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-main-line hover:bg-main-soft hover:text-main"
      >
        {ja.common.backToHome}
      </Link>
    </section>
  );
}
