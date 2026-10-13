import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/components/ui/cn';
import type { MenuItem, MenuTone } from './menus';

const toneClass: Record<MenuTone, { tile: string; hover: string }> = {
  calls: { tile: 'bg-calls-soft text-calls', hover: 'hover:border-calls/50' },
  schedule: { tile: 'bg-schedule-soft text-schedule', hover: 'hover:border-schedule/50' },
  admin: { tile: 'bg-role-admin-soft text-role-admin', hover: 'hover:border-role-admin/40' },
};

export function MenuCard({ item }: { item: MenuItem }) {
  const Icon = item.icon;
  const tone = toneClass[item.tone];
  return (
    <Link
      to={item.path}
      className={cn(
        'group flex items-center gap-4 rounded-(--radius-card) border border-line bg-surface p-5 shadow-(--shadow-card)',
        'transition-[border-color,box-shadow] duration-200 hover:shadow-(--shadow-raised)',
        tone.hover,
      )}
    >
      <span
        className={cn('flex size-14 shrink-0 items-center justify-center rounded-xl', tone.tile)}
      >
        <Icon aria-hidden="true" className="size-7" strokeWidth={2} />
      </span>
      <span className="text-lg font-bold text-ink">{item.title}</span>
      <ChevronRight
        aria-hidden="true"
        className="ml-auto size-5 text-ink-sub transition-transform duration-200 group-hover:translate-x-0.5"
      />
    </Link>
  );
}
