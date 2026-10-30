import { CompanyFlag } from '@telesales/shared';
import { cn } from '@/components/ui/cn';
import { StatusLabel } from '@/components/ui/StatusLabel';
import { ja } from '@/i18n/ja';

interface GradeLook {
  /** The letter square; turns solid when its card is chosen (group-aria-pressed). */
  badge: string;
  /** Ring and tint of a chosen grade card. */
  chosen: string;
  hint: string;
}

/** Colour per grade, matching GradeBadge: A got it, B/C call again later, D stop, E not counted. */
const GRADE_LOOK: Record<string, GradeLook> = {
  A: {
    badge:
      'bg-success-soft text-success group-aria-pressed:bg-success group-aria-pressed:text-white',
    chosen: 'aria-pressed:bg-success-soft aria-pressed:ring-success',
    hint: 'アポが取れた',
  },
  B: {
    badge:
      'bg-warning-soft text-warning-ink group-aria-pressed:bg-warning-ink group-aria-pressed:text-white',
    chosen: 'aria-pressed:bg-warning-soft aria-pressed:ring-warning-ink',
    hint: '時期を改めてかけ直す',
  },
  C: {
    badge:
      'bg-schedule-soft text-schedule group-aria-pressed:bg-schedule group-aria-pressed:text-white',
    chosen: 'aria-pressed:bg-schedule-soft aria-pressed:ring-schedule',
    hint: '期間をおいてかけ直す',
  },
  D: {
    badge: 'bg-danger-soft text-danger group-aria-pressed:bg-danger group-aria-pressed:text-white',
    chosen: 'aria-pressed:bg-danger-soft aria-pressed:ring-danger',
    hint: '今後はかけない',
  },
};
const OTHER_LOOK = {
  badge: 'bg-admin-soft text-admin group-aria-pressed:bg-admin group-aria-pressed:text-white',
  chosen: 'aria-pressed:bg-admin-soft aria-pressed:ring-admin',
  hint: '',
};

export function gradeLook(code: string): GradeLook {
  return GRADE_LOOK[code] ?? OTHER_LOOK;
}

/** A grade in lists: its letter in the grade colour, then the name. */
export function GradeBadge({ grade, label }: { grade: string; label?: string }) {
  const bracket = label ? /^(.+?)[（(].+[)）]$/.exec(label) : null;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-bold whitespace-nowrap text-ink">
      <span
        aria-hidden="true"
        className={cn('grid size-5 shrink-0 place-items-center text-xs', gradeLook(grade).badge)}
      >
        {grade}
      </span>
      <span className="sr-only">{grade}：</span>
      {bracket?.[1] ?? label ?? grade}
    </span>
  );
}

export function FlagBadge({ flag }: { flag: CompanyFlag }) {
  if (flag === CompanyFlag.None) return null;
  return (
    <StatusLabel tone={flag === CompanyFlag.Duplicate ? 'danger' : 'warning'} secondary>
      {ja.companyFlag[flag]}
    </StatusLabel>
  );
}
