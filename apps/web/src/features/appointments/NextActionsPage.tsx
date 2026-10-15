import { useState } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { cn } from '@/components/ui/cn';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDate, todayJst } from '@/lib/format';
import { useNextActions, useSetNextActionDone } from './api';

/** A rep's own next actions from meeting results (spec §6, priority 2). */
export function NextActionsPage() {
  const [includeDone, setIncludeDone] = useState(false);
  const query = useNextActions(includeDone);
  const setDone = useSetNextActionDone();
  const today = todayJst();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-sm text-ink-sub">
          自分が入れた打ち合わせ結果と、自分が担当のアポの「次回アクション」です。
        </p>
        <Checkbox
          className="ml-auto"
          label="済んだものも表示"
          checked={includeDone}
          onChange={(e) => setIncludeDone(e.target.checked)}
        />
      </div>
      {setDone.isError && <Alert tone="error">{errorMessageOf(setDone.error)}</Alert>}
      <QueryState query={query}>
        {(items) =>
          items.length === 0 ? (
            <Card>
              <EmptyState mood="approved">次回アクションはありません。</EmptyState>
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((item) => {
                const overdue =
                  !item.doneAt && !!item.nextActionDate && item.nextActionDate < today;
                const dueToday = !item.doneAt && item.nextActionDate === today;
                return (
                  <li key={item.resultId}>
                    <Card
                      className={cn(overdue && 'border-danger/40', item.doneAt && 'opacity-70')}
                    >
                      <div className="flex flex-wrap items-start gap-4">
                        <Checkbox
                          label={<span className="sr-only">済んだ</span>}
                          checked={!!item.doneAt}
                          disabled={setDone.isPending}
                          onChange={(e) =>
                            setDone.mutate({ resultId: item.resultId, done: e.target.checked })
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <p className={cn('font-medium', item.doneAt && 'line-through')}>
                            {item.nextAction}
                          </p>
                          <p className="mt-1 text-sm text-ink-sub">
                            <Link
                              to={paths.appointment(item.appointmentId)}
                              className="font-bold text-link hover:underline"
                            >
                              {item.company.name}
                            </Link>
                            ・訪問 {formatDate(item.visitedOn)}・入力 {item.author.name}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'text-sm tabular-nums',
                            overdue
                              ? 'font-bold text-danger'
                              : dueToday
                                ? 'font-bold text-main'
                                : 'text-ink-sub',
                          )}
                        >
                          {item.nextActionDate
                            ? `${formatDate(item.nextActionDate)}${overdue ? '（期限切れ）' : dueToday ? '（今日）' : ''}`
                            : '日付なし'}
                        </span>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )
        }
      </QueryState>
    </div>
  );
}
