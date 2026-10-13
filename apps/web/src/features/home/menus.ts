import { Role } from '@telesales/shared';
import { CalendarDays, Database, type LucideIcon, PhoneCall, Users } from 'lucide-react';
import { paths } from '@/app/paths';
import { ja } from '@/i18n/ja';

export type MenuTone = 'calls' | 'schedule' | 'admin';

export interface MenuItem {
  key: string;
  title: string;
  path: string;
  icon: LucideIcon;
  tone: MenuTone;
}

/** The entry points shown on each role's home. Add new modules here. */
export const menusByRole: Readonly<Record<Role, readonly MenuItem[]>> = {
  [Role.Telema]: [
    {
      key: 'calls',
      title: ja.module.calls,
      path: paths.telema.calls,
      icon: PhoneCall,
      tone: 'calls',
    },
    {
      key: 'schedule',
      title: ja.module.schedule,
      path: paths.telema.schedule,
      icon: CalendarDays,
      tone: 'schedule',
    },
  ],
  [Role.Sales]: [
    {
      key: 'calls',
      title: ja.module.calls,
      path: paths.sales.calls,
      icon: PhoneCall,
      tone: 'calls',
    },
    {
      key: 'schedule',
      title: ja.module.schedule,
      path: paths.sales.schedule,
      icon: CalendarDays,
      tone: 'schedule',
    },
  ],
  [Role.Admin]: [
    { key: 'users', title: ja.module.users, path: paths.admin.users, icon: Users, tone: 'admin' },
    {
      key: 'masters',
      title: ja.module.masters,
      path: paths.admin.masters,
      icon: Database,
      tone: 'admin',
    },
  ],
};
