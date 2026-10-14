import { CompanyFlag } from '@telesales/shared';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { useFlaggedCompanies, useResolveFlag } from './api';
import { FlagBadge } from './CallBadges';

/** The lead decides how duplicates and check flags are handled (spec §4, §7). */
export function DuplicatesPage() {
  const query = useFlaggedCompanies(true);
  const resolve = useResolveFlag();
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info">
        電話番号が同じ「重複」は、扱いを決めるまで架電対象から外れています。会社名だけ同じ「要確認」は架電対象に残っています。
      </Alert>
      {resolve.isError && <Alert tone="error">{errorMessageOf(resolve.error)}</Alert>}
      <QueryState query={query}>
        {(items) =>
          items.length === 0 ? (
            <Card>
              <EmptyState>扱いを決める企業はありません。</EmptyState>
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((company) => (
                <li key={company.id}>
                  <Card>
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <FlagBadge flag={company.flag} />
                          <Link
                            to={paths.company(company.id)}
                            className="font-bold text-link hover:underline"
                          >
                            {company.name}
                          </Link>
                          <span className="text-sm text-ink-sub">{company.phone}</span>
                        </div>
                        <p className="mt-1 text-sm text-ink-sub">
                          リスト：{company.listName ?? '―'}
                          {company.flagMatches.map((match) => (
                            <span key={match.id} className="ml-3">
                              一致した企業：
                              <Link
                                to={paths.company(match.id)}
                                className="text-link hover:underline"
                              >
                                {match.name}（{match.phone}）
                              </Link>
                            </span>
                          ))}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          loading={
                            resolve.isPending &&
                            resolve.variables.id === company.id &&
                            resolve.variables.request.action === 'EXCLUDE'
                          }
                          onClick={() =>
                            resolve.mutate({ id: company.id, request: { action: 'EXCLUDE' } })
                          }
                        >
                          同じ会社なので架電しない
                        </Button>
                        <Button
                          loading={
                            resolve.isPending &&
                            resolve.variables.id === company.id &&
                            resolve.variables.request.action === 'KEEP'
                          }
                          onClick={() =>
                            resolve.mutate({ id: company.id, request: { action: 'KEEP' } })
                          }
                        >
                          {company.flag === CompanyFlag.Duplicate
                            ? '別の会社として架電対象にする'
                            : '問題なし（このまま）'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
    </div>
  );
}
