import { Outlet } from 'react-router';
import { paths } from '@/app/paths';
import { PageHeader } from '@/components/ui/PageHeader';
import { type TabItem, Tabs } from '@/components/ui/Tabs';
import { useHomeSummary } from '@/features/dashboard/api';
import { ja } from '@/i18n/ja';
import { useTelemaAccess } from './telemaAccess';

/** ② Telemarketing (priority 2): today's staff, shifts, auto allocation, telemarketer info. */
export function TelemaLayout() {
  const { manages } = useTelemaAccess();
  const summary = useHomeSummary();
  const tabs: TabItem[] = [
    { to: paths.telema, label: '今日', end: true },
    { to: paths.telemaShifts, label: 'シフト' },
    {
      to: paths.telemaAllocation,
      label: '割り振り',
      count: manages && summary.data?.allocationToConfirm ? 1 : undefined,
    },
    { to: paths.telemaPeople, label: 'テレマ情報' },
  ];
  return (
    <>
      <PageHeader title={ja.module.telema} />
      <Tabs items={tabs} />
      <Outlet />
    </>
  );
}
