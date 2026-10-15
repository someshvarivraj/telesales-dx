import { Permission } from '@telesales/shared';
import { Outlet } from 'react-router';
import { paths } from '@/app/paths';
import { PageHeader } from '@/components/ui/PageHeader';
import { type TabItem, Tabs } from '@/components/ui/Tabs';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { ja } from '@/i18n/ja';

export function CallsLayout() {
  const { permissions } = useCurrentUser();
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
      <PageHeader title={ja.module.calls} />
      <Tabs items={tabs} />
      <Outlet />
    </>
  );
}
