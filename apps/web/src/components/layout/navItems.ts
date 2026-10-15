import { Permission } from '@telesales/shared';
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Home,
  type LucideIcon,
  PhoneCall,
  Settings,
  UsersRound,
} from 'lucide-react';
import { paths } from '@/app/paths';
import { ja } from '@/i18n/ja';

export interface NavItem {
  to: string;
  /** Short label for the phone tab bar. */
  label: string;
  /** Fuller label for the side menu, where there is room. */
  sideLabel: string;
  /** Side menu section: the daily work, or settings. */
  group: 'main' | 'work' | 'settings';
  icon: LucideIcon;
  anyOf: readonly Permission[];
  end?: boolean;
}

export const navItems: readonly NavItem[] = [
  {
    to: paths.home,
    label: ja.nav.home,
    sideLabel: ja.nav.home,
    group: 'main',
    icon: Home,
    anyOf: [Permission.ViewData],
    end: true,
  },
  {
    to: paths.calls,
    label: ja.nav.calls,
    sideLabel: '架電状況',
    group: 'work',
    icon: PhoneCall,
    anyOf: [Permission.ViewData],
  },
  {
    to: paths.schedule,
    label: ja.nav.schedule,
    sideLabel: 'スケジュール',
    group: 'work',
    icon: CalendarDays,
    anyOf: [Permission.ViewData],
  },
  {
    to: paths.appointments,
    label: ja.nav.appointments,
    sideLabel: ja.module.appointments,
    group: 'work',
    icon: ClipboardList,
    anyOf: [Permission.ViewData],
  },
  {
    to: paths.dashboard,
    label: ja.nav.dashboard,
    sideLabel: ja.module.dashboard,
    group: 'work',
    icon: BarChart3,
    anyOf: [Permission.ViewData],
  },
  {
    to: paths.telema,
    label: ja.nav.telema,
    sideLabel: ja.module.telema,
    group: 'work',
    icon: UsersRound,
    anyOf: [Permission.WriteShifts, Permission.ConfirmAllocation, Permission.Administer],
  },
  {
    to: paths.admin.root,
    label: ja.nav.admin,
    sideLabel: '管理',
    group: 'settings',
    icon: Settings,
    anyOf: [Permission.Administer, Permission.EditAreaTable],
  },
];

export function visibleNav(permissions: readonly Permission[]): NavItem[] {
  return navItems.filter((item) =>
    item.anyOf.some((permission) => permissions.includes(permission)),
  );
}
