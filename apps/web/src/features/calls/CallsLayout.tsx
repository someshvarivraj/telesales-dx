import { Permission, Role } from '@telesales/shared';
import { Clock, Download } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet } from 'react-router';
import { paths } from '@/app/paths';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StickyTop } from '@/components/ui/StickyTop';
import { type TabItem, Tabs } from '@/components/ui/Tabs';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { ja } from '@/i18n/ja';
import { CallExportDialog } from './CallExportDialog';

export function CallsLayout() {
  const { permissions, roles } = useCurrentUser();
  // A plain テレマ just calls (item 14, 11/17): the list, the reps' calendar beside it and the shift.
  const plain = roles.length > 0 && roles.every((role) => role === Role.Telema);
  const [exporting, setExporting] = useState(false);
  const tabs: TabItem[] = [
    { to: paths.calls, label: '架電対象', end: true },
    ...(permissions.includes(Permission.ImportLists)
      ? [{ to: paths.callsImport, label: 'リスト取り込み' }]
      : []),
    ...(plain ? [] : [{ to: paths.callsImports, label: '取り込み履歴' }]),
    ...(permissions.includes(Permission.ResolveDuplicates)
      ? [{ to: paths.callsDuplicates, label: '重複・要確認' }]
      : []),
    { to: paths.callsAvoid, label: '回避企業' },
    // リスト分析 (11/27): telemarketing leads and admins.
    ...(permissions.includes(Permission.ConfirmAllocation) ||
    permissions.includes(Permission.Administer)
      ? [{ to: paths.callsAnalytics, label: 'リスト分析' }]
      : []),
  ];
  return (
    <>
      <StickyTop>
        <PageHeader
          title={ja.module.calls}
          actions={
            plain ? (
              <Link
                to={paths.telemaShifts}
                className="inline-flex h-9 items-center gap-2 border border-line-strong bg-surface px-3 text-sm font-bold text-ink hover:bg-hover"
              >
                <Clock aria-hidden="true" className="size-4" />
                シフトを入力
              </Link>
            ) : (
              <Button
                variant="secondary"
                icon={<Download className="size-4" aria-hidden="true" />}
                onClick={() => setExporting(true)}
              >
                架電結果をExcelで出す
              </Button>
            )
          }
        />
        <Tabs items={tabs} />
      </StickyTop>
      <Outlet />
      {exporting && <CallExportDialog open onClose={() => setExporting(false)} />}
    </>
  );
}
