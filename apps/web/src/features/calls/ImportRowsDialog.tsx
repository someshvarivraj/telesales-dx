import {
  LIST_IMPORT_ROW_STATUSES,
  type ListImportDto,
  ListImportRowStatus,
} from '@telesales/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Select } from '@/components/ui/Select';
import { Table, Td, Th } from '@/components/ui/Table';
import { ja } from '@/i18n/ja';
import { useImportRows } from './api';

const STATUS_TONE: Record<ListImportRowStatus, BadgeTone> = {
  [ListImportRowStatus.Imported]: 'success',
  [ListImportRowStatus.Duplicate]: 'danger',
  [ListImportRowStatus.NeedsCheck]: 'warning',
  [ListImportRowStatus.Invalid]: 'danger',
};

const STATUS_OPTIONS = LIST_IMPORT_ROW_STATUSES.map((status) => ({
  value: status,
  label: ja.importRowStatus[status],
}));

/** One import, row by row: what was read, how it was judged, and which company it became. */
export function ImportRowsDialog({
  listImport,
  onClose,
}: {
  listImport: ListImportDto;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<ListImportRowStatus | ''>('');
  const query = useImportRows(listImport.id, status);
  return (
    <Dialog
      open
      size="lg"
      title={`${listImport.listName} の行`}
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {ja.common.close}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="import-row-status" className="text-sm font-bold">
            判定
          </label>
          <Select
            id="import-row-status"
            className="w-40"
            value={status}
            placeholder="すべて"
            options={STATUS_OPTIONS}
            onChange={(event) => setStatus(event.target.value as ListImportRowStatus | '')}
          />
          <span className="text-xs text-ink-sub">
            重複・要確認の会社は、まとめると元の会社に移ります。
          </span>
        </div>
        <QueryState query={query}>
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState>この判定の行はありません。</EmptyState>
            ) : (
              <div className="max-h-[60vh] overflow-auto rounded-(--radius-control) border border-line">
                <Table>
                  <thead>
                    <tr>
                      <Th className="w-16">行</Th>
                      <Th className="w-24">判定</Th>
                      <Th>会社</Th>
                      <Th className="max-md:hidden">読み取った値</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <Td className="tabular-nums">{row.rowNumber}</Td>
                        <Td>
                          <Badge tone={STATUS_TONE[row.status]}>
                            {ja.importRowStatus[row.status]}
                          </Badge>
                        </Td>
                        <Td>
                          {row.company ? (
                            <Link
                              to={paths.company(row.company.id)}
                              className="font-bold text-link hover:underline"
                            >
                              {row.company.name}
                            </Link>
                          ) : (
                            <span className="text-ink-sub">―</span>
                          )}
                          {row.errorMessage && (
                            <p className="mt-0.5 text-xs text-danger">{row.errorMessage}</p>
                          )}
                        </Td>
                        <Td className="text-xs break-all text-ink-sub max-md:hidden">
                          {Object.entries(row.rawData)
                            .map(([header, value]) => `${header}：${value}`)
                            .join('　')}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )
          }
        </QueryState>
      </div>
    </Dialog>
  );
}
