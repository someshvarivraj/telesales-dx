import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Select } from '@/components/ui/Select';
import { Table, Td, Th } from '@/components/ui/Table';
import { formatDateTime } from '@/lib/format';
import { useAuditLog } from './api';

const TARGETS = [
  { value: 'appointment', label: 'アポ' },
  { value: 'plan', label: '予定' },
  { value: 'user', label: 'ユーザー・権限' },
  { value: 'company', label: '企業' },
  { value: 'call_record', label: '架電記録' },
  { value: 'list_import', label: 'リスト取り込み' },
  { value: 'email', label: 'メール' },
  { value: 'notice_setting', label: '通知の設定' },
];

function short(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = JSON.stringify(value);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

/** Who changed what and when, before and after (spec §2-9, §11). */
export function AuditPage() {
  const [targetType, setTargetType] = useState('');
  const query = useAuditLog({ targetType: targetType || undefined, limit: 200 });
  return (
    <Card
      title="操作履歴"
      actions={
        <div className="w-48">
          <Select
            aria-label="対象"
            value={targetType}
            placeholder="すべて"
            options={TARGETS}
            onChange={(e) => setTargetType(e.target.value)}
          />
        </div>
      }
      flush
    >
      <QueryState query={query}>
        {(items) =>
          items.length === 0 ? (
            <EmptyState>履歴はありません。</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>日時</Th>
                  <Th>誰</Th>
                  <Th>操作</Th>
                  <Th className="max-lg:hidden">変更前</Th>
                  <Th className="max-lg:hidden">変更後</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <Td className="whitespace-nowrap">{formatDateTime(item.createdAt)}</Td>
                    <Td className="whitespace-nowrap">{item.actor?.name ?? 'システム'}</Td>
                    <Td>
                      <code className="text-xs">{item.action}</code>
                    </Td>
                    <Td className="max-w-xs text-xs break-all text-ink-sub max-lg:hidden">
                      {short(item.before)}
                    </Td>
                    <Td className="max-w-xs text-xs break-all max-lg:hidden">
                      {short(item.after)}
                    </Td>
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
