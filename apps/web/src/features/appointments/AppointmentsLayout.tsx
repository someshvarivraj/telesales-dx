import { Permission } from '@telesales/shared';
import { FileUp } from 'lucide-react';
import { Link, Outlet } from 'react-router';
import { paths } from '@/app/paths';
import { PageHeader } from '@/components/ui/PageHeader';
import { type TabItem, Tabs } from '@/components/ui/Tabs';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { useHomeSummary } from '@/features/dashboard/api';
import { existingListBookingHref } from '@/features/schedule/bookingLinks';
import { ja } from '@/i18n/ja';
import { todayJst } from '@/lib/format';

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
    ...(permissions.includes(Permission.WorkOnAppointments)
      ? [
          {
            to: paths.nextActions,
            label: '次回アクション',
            count: summary.data?.nextActionsDue || undefined,
          },
        ]
      : []),
  ];
  return (
    <>
      <PageHeader
        title={ja.module.appointments}
        actions={
          permissions.includes(Permission.ManageTelemaAppointments) ? (
            <Link
              to={existingListBookingHref(todayJst())}
              className="inline-flex h-10 items-center gap-2 rounded-(--radius-control) border border-line bg-surface px-4 text-sm font-bold hover:bg-column"
            >
              <FileUp className="size-4" aria-hidden="true" />
              既存リストのアポを登録
            </Link>
          ) : undefined
        }
      />
      <Tabs items={tabs} />
      <Outlet />
    </>
  );
}
