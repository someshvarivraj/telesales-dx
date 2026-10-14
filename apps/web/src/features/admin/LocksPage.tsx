import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Table, Td, Th } from '@/components/ui/Table';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDateTime, formatRange } from '@/lib/format';
import { useAdminLocks, useReleaseLock } from './api';

/** Edit locks that are currently held; admins can release one by hand (spec §7). */
export function LocksPage() {
  const query = useAdminLocks();
  const release = useReleaseLock();
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info">
        画面を閉じた・通信が切れたときは、約2分で自動的に解除されます。それでも残っているときに解除してください。
      </Alert>
      {release.isError && <Alert tone="error">{errorMessageOf(release.error)}</Alert>}
      <Card flush>
        <QueryState query={query}>
          {(locks) =>
            locks.length === 0 ? (
              <EmptyState>いま押さえられている枠はありません。</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>営業</Th>
                    <Th>時間帯</Th>
                    <Th>編集中の人</Th>
                    <Th>有効期限</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {locks.map((lock) => (
                    <tr key={lock.id}>
                      <Td>{lock.salesRep.name}</Td>
                      <Td className="whitespace-nowrap">
                        {formatRange(lock.startsAt, lock.endsAt)}
                      </Td>
                      <Td>{lock.lockedBy.name}</Td>
                      <Td className="whitespace-nowrap">{formatDateTime(lock.expiresAt)}</Td>
                      <Td>
                        <Button
                          variant="danger"
                          loading={release.isPending && release.variables === lock.id}
                          onClick={() => release.mutate(lock.id)}
                        >
                          解除
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )
          }
        </QueryState>
      </Card>
    </div>
  );
}
