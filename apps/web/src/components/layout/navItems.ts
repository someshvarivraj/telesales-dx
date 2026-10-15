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
  label: string;
  icon: LucideIcon;
  anyOf: readonly Permission[];
  end?: boolean;
}

export const navItems: readonly NavItem[] = [
  { to: paths.home, label: ja.nav.home, icon: Home, anyOf: [Permission.ViewData], end: true },
  { to: paths.calls, label: ja.nav.calls, icon: PhoneCall, anyOf: [Permission.ViewData] },
  { to: paths.schedule, label: ja.nav.schedule, icon: CalendarDays, anyOf: [Permission.ViewData] },
  {
    to: paths.appointments,
    label: ja.nav.appointments,
    icon: ClipboardList,
    anyOf: [Permission.ViewData],
  },
  { to: paths.dashboard, label: ja.nav.dashboard, icon: BarChart3, anyOf: [Permission.ViewData] },
  {
    to: paths.telema,
    label: ja.nav.telema,
    icon: UsersRound,
    anyOf: [Permission.WriteShifts, Permission.ConfirmAllocation, Permission.Administer],
  },
  {
    to: paths.admin.root,
    label: ja.nav.admin,
    icon: Settings,
    anyOf: [Permission.Administer, Permission.EditAreaTable],
  },
];

export function visibleNav(permissions: readonly Permission[]): NavItem[] {
  return navItems.filter((item) =>
    item.anyOf.some((permission) => permissions.includes(permission)),
  );
}
