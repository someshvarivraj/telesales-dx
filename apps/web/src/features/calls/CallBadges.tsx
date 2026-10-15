import { CompanyFlag } from '@telesales/shared';
import { StatusLabel, type StatusTone } from '@/components/ui/StatusLabel';
import { ja } from '@/i18n/ja';

/* Same dot-and-text style as the appointment states, so every role's lists look alike. */

const GRADE_TONE: Record<string, StatusTone> = {
  A: 'success',
  B: 'warning',
  C: 'neutral',
  D: 'neutral',
};

export function GradeBadge({ grade, label }: { grade: string; label?: string }) {
  return (
    <StatusLabel tone={GRADE_TONE[grade] ?? 'neutral'}>
      {grade}
      {label ? `：${label}` : ''}
    </StatusLabel>
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
