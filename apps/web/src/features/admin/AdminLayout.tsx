import { Outlet } from 'react-router';
import { PageHeader } from '@/components/ui/PageHeader';
import { type TabItem, Tabs } from '@/components/ui/Tabs';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { adminMenu, visibleItems } from '@/features/home/menus';
import { ja } from '@/i18n/ja';

export function AdminLayout() {
  const { permissions } = useCurrentUser();
  const tabs: TabItem[] = visibleItems(adminMenu, permissions).map((item) => ({
    to: item.path,
    label: item.title,
  }));
  return (
    <>
      <PageHeader title={ja.admin.title} />
      <Tabs items={tabs} />
      <Outlet />
    </>
  );
}
