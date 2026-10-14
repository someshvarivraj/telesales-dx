import { Permission } from '@telesales/shared';
import { Outlet } from 'react-router';
import { paths } from '@/app/paths';
import { PageHeader } from '@/components/ui/PageHeader';
import { type TabItem, Tabs } from '@/components/ui/Tabs';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { useHomeSummary } from '@/features/dashboard/api';
import { ja } from '@/i18n/ja';

export function AppointmentsLayout() {
  const { permissions } = useCurrentUser();
  const summary = useHomeSummary();
  const telema = permissions.includes(Permission.WriteDayBeforeChecks);
  const tabs: TabItem[] = [
    { to: paths.appointments, label: 'アポ一覧', end: true },
    {
      to: paths.dayBefore,
      label: '前日確認',
      count: telema ? summary.data?.dayBeforePending : undefined,
    },
    {
      to: paths.changeRequests,
      label: '変更依頼',
      count: permissions.includes(Permission.HandleChangeRequests)
        ? summary.data?.openChangeRequests
        : undefined,
    },
  ];
  return (
    <>
      <PageHeader title={ja.module.appointments} />
      <Tabs items={tabs} />
      <Outlet />
    </>
  );
}
