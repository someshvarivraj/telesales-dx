import { type CompanyDetail, Permission } from '@telesales/shared';
import { Building2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { useCompanyGroup } from './api';

function place(company: { office: string | null; department: string | null }): string {
  return [company.office, company.department].filter(Boolean).join(' ') || '（事業所・部署なし）';
}

/**
 * 同じ会社の部署・事業所 (request 11/2): same-name companies with another department or office
 * are kept apart (own phone, own calls) but grouped, and shown together here. Ticking the
 * same-name ones below groups them with this company.
 */
export function CompanyGroupCard({ company }: { company: CompanyDetail }) {
  const canEditCompanies = usePermission(Permission.EditCompanies);
  const canResolve = usePermission(Permission.ResolveDuplicates);
  const canEdit = canEditCompanies || canResolve;
  const { group, ungroup } = useCompanyGroup(company.id);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const members = company.groupMembers;
  const candidates = company.sameNameCompanies;
  if (members.length === 0 && candidates.length === 0) return null;
  const error = group.error ?? ungroup.error;

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Building2 className="size-5 text-ink-sub" aria-hidden="true" />
          同じ会社の部署・事業所
        </span>
      }
      actions={
        canEdit && members.length > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            loading={ungroup.isPending}
            onClick={() => ungroup.mutate()}
          >
            この企業をグループから外す
          </Button>
        ) : undefined
      }
    >
      {error && (
        <Alert tone="error" className="mb-3">
          {errorMessageOf(error)}
        </Alert>
      )}
      {members.length > 0 && (
        <ul className="mb-4 flex flex-col divide-y divide-line border border-line">
          <li className="flex flex-wrap items-center gap-2 bg-main-soft/50 px-3 py-2 text-sm">
            <span className="font-bold">{place(company)}</span>
            <Badge tone="info">この企業</Badge>
          </li>
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <Link to={paths.company(member.id)} className="font-bold text-link hover:underline">
                {place(member)}
              </Link>
              {member.isGroupRoot && <Badge tone="outline">代表</Badge>}
              {member.phone && (
                <span className="ml-auto text-ink-sub tabular-nums">{member.phone}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {candidates.length > 0 && canEdit && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink-sub">
            同じ会社名の企業があります。同じ会社の別の部署・事業所なら、チェックしてまとめてください（電話番号と架電の記録はそれぞれ別のままです）。
          </p>
          <ul className="flex flex-col gap-1">
            {candidates.map((other) => (
              <li key={other.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="check-input"
                    checked={ticked.has(other.id)}
                    onChange={(event) =>
                      setTicked((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(other.id);
                        else next.delete(other.id);
                        return next;
                      })
                    }
                  />
                  <span className="font-bold">{place(other)}</span>
                  {other.phone && <span className="text-ink-sub tabular-nums">{other.phone}</span>}
                  <Link
                    to={paths.company(other.id)}
                    className="ml-auto text-xs text-link hover:underline"
                  >
                    開く
                  </Link>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={ticked.size === 0}
              loading={group.isPending}
              onClick={() =>
                group.mutate({ companyIds: [...ticked] }, { onSuccess: () => setTicked(new Set()) })
              }
            >
              {`チェックした${ticked.size || ''}件を同じ会社の部署・事業所としてまとめる`}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
