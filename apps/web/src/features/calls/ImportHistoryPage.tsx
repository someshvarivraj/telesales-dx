import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Table, Td, Th } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { formatDateTime } from '@/lib/format';
import { ja } from '@/i18n/ja';
import { useListImports } from './api';

/** Import log: when, who, purpose, counts and the original file (spec §5). */
export function ImportHistoryPage() {
  const query = useListImports();
  return (
    <Card flush>
      <QueryState query={query}>
        {(items) =>
          items.length === 0 ? (
            <EmptyState>まだ取り込みはありません。</EmptyState>
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
                    </Td>
                    <Td className="text-xs whitespace-nowrap text-ink-sub">
                      登録 {item.createdCount} ／ 重複 {item.duplicateCount} ／ 要確認{' '}
                      {item.checkCount} ／ 不備 {item.errorCount}
                    </Td>
                    <Td className="max-md:hidden">{item.importedBy.name}</Td>
                    <Td className="break-all max-lg:hidden">{item.fileName}</Td>
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
