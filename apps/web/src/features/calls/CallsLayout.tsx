import { Permission } from '@telesales/shared';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { Outlet } from 'react-router';
import { paths } from '@/app/paths';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { type TabItem, Tabs } from '@/components/ui/Tabs';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { ja } from '@/i18n/ja';
import { CallExportDialog } from './CallExportDialog';

export function CallsLayout() {
  const { permissions } = useCurrentUser();
  const [exporting, setExporting] = useState(false);
  const tabs: TabItem[] = [
    { to: paths.calls, label: '架電対象', end: true },
    ...(permissions.includes(Permission.ImportLists)
      ? [{ to: paths.callsImport, label: 'リスト取り込み' }]
      : []),
    { to: paths.callsImports, label: '取り込み履歴' },
    ...(permissions.includes(Permission.ResolveDuplicates)
      ? [{ to: paths.callsDuplicates, label: '重複・要確認' }]
      : []),
  ];
  return (
    <>
      <PageHeader
        title={ja.module.calls}
        actions={
          <Button
            variant="secondary"
            icon={<Download className="size-4" aria-hidden="true" />}
            onClick={() => setExporting(true)}
          >
            架電結果をExcelで出す
          </Button>
        }
      />
      <Tabs items={tabs} />
      <Outlet />
      {exporting && <CallExportDialog open onClose={() => setExporting(false)} />}
    </>
  );
}
