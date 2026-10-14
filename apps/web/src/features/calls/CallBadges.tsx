import { CompanyFlag } from '@telesales/shared';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { ja } from '@/i18n/ja';

const GRADE_TONE: Record<string, BadgeTone> = {
  A: 'success',
  B: 'warning',
  C: 'neutral',
  D: 'outline',
};

export function GradeBadge({ grade, label }: { grade: string; label?: string }) {
  return (
    <Badge tone={GRADE_TONE[grade] ?? 'neutral'}>
      {grade}
      {label ? `：${label}` : ''}
    </Badge>
  );
}

export function FlagBadge({ flag }: { flag: CompanyFlag }) {
  if (flag === CompanyFlag.None) return null;
  return (
    <Badge tone={flag === CompanyFlag.Duplicate ? 'danger' : 'warning'}>
      {ja.companyFlag[flag]}
    </Badge>
  );
}
