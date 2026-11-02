import { type AvoidPhoneDto, Permission } from '@telesales/shared';
import { FileUp, Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileDrop } from '@/components/ui/FileDrop';
import { QueryState } from '@/components/ui/QueryState';
import { Table, Td, Th } from '@/components/ui/Table';
import { TextInput } from '@/components/ui/TextInput';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { MoraBotProgress } from '@/components/brand/MoraBot';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDateTime } from '@/lib/format';
import { useAvoidList, useImportAvoidList, useRemoveAvoidPhone } from './api';

/**
 * 回避企業 (Sano 10/28 ⑥, 10/30): numbers never called or imported again. The team's Excel is
 * loaded once here; after that companies are added from the call screen.
 */
export function AvoidListPage() {
  const canManage = usePermission(Permission.ManageAvoidList);
  const [keyword, setKeyword] = useState('');
  const deferred = useDeferredValue(keyword.trim());
  const query = useAvoidList(deferred);
  const [importing, setImporting] = useState(false);
  const [removing, setRemoving] = useState<AvoidPhoneDto | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info">
        ここにある電話番号の企業は架電対象から外れ、新しいリストを取り込んでも入りません（電話番号で照合）。架電画面の「回避企業に追加」でも増えます。外せるのはリーダーと管理者だけです。
      </Alert>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-sub"
            aria-hidden="true"
          />
          <TextInput
            type="search"
            className="pl-9"
            placeholder="会社名・電話番号で探す"
            aria-label="会社名・電話番号で探す"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        {query.data && (
          <span className="text-sm text-ink-sub tabular-nums">{`${query.data.length}件`}</span>
        )}
        {canManage && (
          <Button
            variant="secondary"
            className="ml-auto"
            icon={<FileUp className="size-4" aria-hidden="true" />}
            onClick={() => setImporting(true)}
          >
            Excelから追加
          </Button>
        )}
      </div>

      <QueryState query={query}>
        {(items) =>
          items.length === 0 ? (
            <Card>
              {deferred ? (
                <EmptyState>見つかりません。</EmptyState>
              ) : (
                <>
                  <EmptyState>回避企業はまだありません。</EmptyState>
                  {canManage && (
                    <div className="flex justify-center pb-2">
                      <Button onClick={() => setImporting(true)}>
                        回避企業電話番号.xlsx を読み込む
                      </Button>
                    </div>
                  )}
                </>
              )}
            </Card>
          ) : (
            <Card flush>
              <Table stickyHeader>
                <thead>
                  <tr>
                    <Th>電話番号</Th>
                    <Th>会社名</Th>
                    <Th>追加のしかた</Th>
                    <Th className="max-md:hidden">追加した人・日時</Th>
                    {canManage && <Th className="w-0" />}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <Td className="whitespace-nowrap tabular-nums">{item.phone}</Td>
                      <Td data-no-translate>{item.companyName ?? '―'}</Td>
                      <Td>
                        <Badge tone={item.source === 'CALL' ? 'calls' : 'neutral'}>
                          {item.source === 'CALL' ? '架電画面で追加' : '一覧から'}
                        </Badge>
                        {item.untargetedCount > 0 && (
                          <span className="mt-1 block text-xs text-ink-sub">
                            {`架電対象から外した企業 ${item.untargetedCount}件`}
                          </span>
                        )}
                      </Td>
                      <Td className="text-sm whitespace-nowrap text-ink-sub max-md:hidden">
                        <span data-no-translate>{item.createdBy?.name ?? '―'}</span>
                        <span className="block text-xs">{formatDateTime(item.createdAt)}</span>
                      </Td>
                      {canManage && (
                        <Td>
                          <Button size="sm" variant="secondary" onClick={() => setRemoving(item)}>
                            外す
                          </Button>
                        </Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )
        }
      </QueryState>

      {importing && <ImportAvoidDialog onClose={() => setImporting(false)} />}
      {removing && <RemoveAvoidDialog item={removing} onClose={() => setRemoving(null)} />}
    </div>
  );
}

function ImportAvoidDialog({ onClose }: { onClose: () => void }) {
  const upload = useImportAvoidList();
  const done = upload.data;
  return (
    <Dialog
      open
      title="回避企業をExcelから追加"
      onClose={onClose}
      footer={
        <Button variant={done ? 'primary' : 'secondary'} onClick={onClose}>
          {done ? '閉じる' : 'やめる'}
        </Button>
      }
    >
      {done ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-base font-bold">{`${done.addedCount}件を追加しました。`}</p>
          <p className="text-ink-sub">
            {`読み込んだ番号 ${done.readCount}件（すでにあった番号 ${done.existingCount}件）`}
          </p>
          {done.untargetedCount > 0 && (
            <p>{`登録済みの企業 ${done.untargetedCount}件を架電対象から外しました。`}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-sub">
            「回避」シートを読みます（なければ最初のシート）。見出しは要りません。各行の電話番号と、その左の会社名を読み取ります。同じ番号は1件にまとめます。
          </p>
          <FileDrop
            accept=".xlsx,.csv,text/csv"
            hint="Excel（.xlsx）または CSV"
            onFiles={([file]) => file && upload.mutate(file)}
            disabled={upload.isPending}
          />
          {upload.isPending && <MoraBotProgress label="読み込んでいます…" />}
          {upload.isError && (
            <Alert tone="error">
              {(upload.error as { details?: { reason?: string } }).details?.reason ===
              'no_phone_numbers'
                ? '電話番号が見つかりませんでした。'
                : errorMessageOf(upload.error)}
            </Alert>
          )}
        </div>
      )}
    </Dialog>
  );
}

function RemoveAvoidDialog({ item, onClose }: { item: AvoidPhoneDto; onClose: () => void }) {
  const remove = useRemoveAvoidPhone();
  return (
    <Dialog
      open
      title="回避企業から外す"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            やめる
          </Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() => remove.mutate(item.id, { onSuccess: onClose })}
          >
            外す
          </Button>
        </>
      }
    >
      <p className="text-sm">
        <span data-no-translate>{`${item.companyName ?? item.phone}（${item.phone}）`}</span>
        を回避企業から外します。
      </p>
      {item.untargetedCount > 0 && (
        <p className="mt-1 text-sm">このために架電対象から外していた企業は、架電対象に戻ります。</p>
      )}
      <p className="mt-1 text-sm">外したことは履歴に残ります。</p>
      {remove.isError && (
        <Alert tone="error" className="mt-3">
          {errorMessageOf(remove.error)}
        </Alert>
      )}
    </Dialog>
  );
}
