import { Permission } from '@telesales/shared';
import {
  BarChart3,
  CalendarDays,
  SlidersHorizontal,
  CalendarOff,
  ClipboardList,
  type LucideIcon,
  Lock,
  Map,
  Bell,
  ListChecks,
  PhoneCall,
  Power,
  History,
  Users,
  UsersRound,
  MessageSquareText,
} from 'lucide-react';
import { paths } from '@/app/paths';
import { ja } from '@/i18n/ja';

export type MenuTone = 'calls' | 'schedule' | 'appointments' | 'admin';

export interface MenuItem {
  key: string;
  title: string;
  path: string;
  icon: LucideIcon;
  tone: MenuTone;
  /** Shown when the user has at least one of these permissions. */
  anyOf: readonly Permission[];
}

/** Main modules. Everyone can view; what they can edit inside depends on permissions. */
export const mainMenu: readonly MenuItem[] = [
  {
    key: 'calls',
    title: ja.module.calls,
    path: paths.calls,
    icon: PhoneCall,
    tone: 'calls',
    anyOf: [Permission.ViewData],
  },
  {
    key: 'schedule',
    title: ja.module.schedule,
    path: paths.schedule,
    icon: CalendarDays,
    tone: 'schedule',
    anyOf: [Permission.ViewData],
  },
  {
    key: 'appointments',
    title: ja.module.appointments,
    path: paths.appointments,
    icon: ClipboardList,
    tone: 'appointments',
    anyOf: [Permission.ViewData],
  },
  {
    key: 'dashboard',
    title: ja.module.dashboard,
    path: paths.dashboard,
    icon: BarChart3,
    tone: 'appointments',
    anyOf: [Permission.ViewData],
  },
  {
    key: 'telema',
    title: ja.module.telema,
    path: paths.telema,
    icon: UsersRound,
    tone: 'calls',
    anyOf: [Permission.WriteShifts, Permission.ConfirmAllocation, Permission.Administer],
  },
];

/** Admin screens (spec §6). The area table is also open to the person entrusted with it. */
export const adminMenu: readonly MenuItem[] = [
  {
    key: 'users',
    title: ja.admin.users,
    path: paths.admin.users,
    icon: Users,
    tone: 'admin',
    anyOf: [Permission.Administer],
  },
  {
    key: 'feedback',
    title: ja.admin.feedback,
    path: paths.admin.feedback,
    icon: MessageSquareText,
    tone: 'admin',
    anyOf: [Permission.Administer],
  },
  {
    key: 'areaTable',
    title: ja.admin.areaTable,
    path: paths.admin.areaTable,
    icon: Map,
    tone: 'admin',
    anyOf: [Permission.Administer, Permission.EditAreaTable],
  },
  {
    key: 'calendar',
    title: ja.admin.calendar,
    path: paths.admin.calendar,
    icon: CalendarOff,
    tone: 'admin',
    anyOf: [Permission.Administer],
  },
  {
    key: 'options',
    title: ja.admin.options,
    path: paths.admin.options,
    icon: ListChecks,
    tone: 'admin',
    anyOf: [Permission.Administer],
  },
  {
    key: 'notices',
    title: ja.admin.notices,
    path: paths.admin.notices,
    icon: Bell,
    tone: 'admin',
    anyOf: [Permission.Administer],
  },
  {
    key: 'locks',
    title: ja.admin.locks,
    path: paths.admin.locks,
    icon: Lock,
    tone: 'admin',
    anyOf: [Permission.Administer],
  },
  {
    key: 'settings',
    title: ja.admin.settings,
    path: paths.admin.settings,
    icon: SlidersHorizontal,
    tone: 'admin',
    anyOf: [Permission.Administer],
  },
  {
    key: 'apps',
    title: ja.admin.apps,
    path: paths.admin.apps,
    icon: Power,
    tone: 'admin',
    anyOf: [Permission.Administer],
  },
  {
    key: 'audit',
    title: ja.admin.audit,
    path: paths.admin.audit,
    icon: History,
    tone: 'admin',
    anyOf: [Permission.Administer],
  },
];

export function visibleItems(
  items: readonly MenuItem[],
  permissions: readonly Permission[],
): MenuItem[] {
  return items.filter((item) => item.anyOf.some((permission) => permissions.includes(permission)));
}
