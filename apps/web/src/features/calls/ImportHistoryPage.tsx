import { type ListImportDto, Permission } from '@telesales/shared';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Table, Td, Th } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { formatDateTime } from '@/lib/format';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { ja } from '@/i18n/ja';
import { useListImports, useUndoImport } from './api';
import { ApiError } from '@/lib/api/ApiError';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { ImportRowsDialog } from './ImportRowsDialog';

/** Import log: when, who, purpose, counts and the original file (spec §5); each row on request. */
export function ImportHistoryPage() {
  const query = useListImports();
  const { permissions } = useCurrentUser();
  const canSeeRows =
    permissions.includes(Permission.ImportLists) ||
    permissions.includes(Permission.ResolveDuplicates);
  const canUndo = permissions.includes(Permission.ImportLists);
  const [open, setOpen] = useState<ListImportDto | null>(null);
  const [undoing, setUndoing] = useState<ListImportDto | null>(null);
  const [undone, setUndone] = useState<string | null>(null);
  return (
    <Card flush title="取り込み履歴">
      {open && <ImportRowsDialog listImport={open} onClose={() => setOpen(null)} />}
      {undoing && (
        <UndoImportDialog
          listImport={undoing}
          onClose={() => setUndoing(null)}
          onDone={(message) => {
            setUndoing(null);
            setUndone(message);
          }}
        />
      )}
      {undone && (
        <Alert tone="success" className="m-4">
          {undone}
        </Alert>
      )}
      <QueryState query={query}>
        {(items) =>
          items.length === 0 ? (
            <EmptyState scene="calling">まだ取り込みはありません。</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>日時</Th>
                  <Th>リスト名</Th>
                  <Th>目的</Th>
                  <Th>件数</Th>
                  <Th className="max-md:hidden">取り込んだ人</Th>
                  <Th className="max-lg:hidden">元のファイル</Th>
                  {(canSeeRows || canUndo) && <Th className="w-24" />}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <Td className="whitespace-nowrap">{formatDateTime(item.createdAt)}</Td>
                    <Td>
                      <Link
                        to={`${paths.calls}?list=${encodeURIComponent(item.listName)}`}
                        className="font-bold text-link hover:underline"
                      >
                        {item.listName}
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone={item.purpose === 'CALL_REQUEST' ? 'calls' : 'neutral'}>
                        {ja.listPurpose[item.purpose]}
                      </Badge>
                      {item.purpose === 'CALL_REQUEST' && !item.autoAllocate && (
                        <span className="mt-1 block text-xs text-ink-sub">自動割り振りしない</span>
                      )}
                    </Td>
                    <Td className="text-xs whitespace-nowrap text-ink-sub">
                      登録 {item.createdCount} ／ 重複 {item.duplicateCount} ／ 要確認{' '}
                      {item.checkCount} ／ 不備 {item.errorCount}
                      {item.avoidedCount + item.noPhoneCount > 0 && (
                        <span className="block">
                          {`除外：回避企業 ${item.avoidedCount} ／ 電話番号なし ${item.noPhoneCount}`}
                        </span>
                      )}
                    </Td>
                    <Td className="max-md:hidden">{item.importedBy.name}</Td>
                    <Td className="break-all max-lg:hidden">{item.fileName}</Td>
                    {(canSeeRows || canUndo) && (
                      <Td>
                        <div className="flex flex-wrap justify-end gap-2">
                          {canSeeRows && (
                            <Button variant="secondary" size="sm" onClick={() => setOpen(item)}>
                              行を見る
                            </Button>
                          )}
                          {canUndo && (
                            <Button variant="danger" size="sm" onClick={() => setUndoing(item)}>
                              取り込みを取り消す
                            </Button>
                          )}
                        </div>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        }
      </QueryState>
    </Card>
  );
}

/**
 * 取り込みを取り消す (request 11/2): a list imported by mistake goes back out, with the companies
 * it created. Only while nobody has worked on it: the server refuses otherwise and says why.
 */
function UndoImportDialog({
  listImport,
  onClose,
  onDone,
}: {
  listImport: ListImportDto;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const undo = useUndoImport();
  const error = undo.error;
  const inUse =
    ApiError.isApiError(error) &&
    (error.details as { reason?: string } | undefined)?.reason === 'list_in_use'
      ? (error.details as { calls: number; appointments: number; allocations: number })
      : null;
  return (
    <Dialog
      open
      title="取り込みを取り消しますか？"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            やめる
          </Button>
          <Button
            variant="danger"
            loading={undo.isPending}
            disabled={Boolean(inUse)}
            onClick={() =>
              undo.mutate(listImport.id, {
                onSuccess: (result) =>
                  onDone(
                    `「${listImport.listName}」の取り込みを取り消しました（企業 ${result.removedCompanies}件を削除${
                      result.keptCompanies > 0
                        ? `・ほかのリストにもある ${result.keptCompanies}件は残しました`
                        : ''
                    }）。同じファイルをもう一度取り込めます。`,
                  ),
              })
            }
          >
            取り消す
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <p>
          <span className="font-bold" data-no-translate>
            {listImport.listName}
          </span>
          {`（${formatDateTime(listImport.createdAt)}・登録 ${listImport.createdCount}件）`}
        </p>
        <p>
          この取り込みで登録した企業を削除し、取り込み履歴からも消します。ほかのリストでも取り込まれている企業は残します。取り消したあと、同じファイルをもう一度取り込めます。
        </p>
        <p className="text-ink-sub">
          まだ誰も架電・アポ登録・割り振りの確定をしていないときだけ取り消せます。取り消したことは履歴に残ります。
        </p>
        {inUse ? (
          <Alert tone="warning">
            {`この取り込みの企業には、すでに架電 ${inUse.calls}件・アポ ${inUse.appointments}件・確定した割り振り ${inUse.allocations}件があるため、取り消せません（記録が消えてしまうため）。`}
          </Alert>
        ) : (
          error && <Alert tone="error">{errorMessageOf(error)}</Alert>
        )}
      </div>
    </Dialog>
  );
}
