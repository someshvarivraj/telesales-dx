import { Permission } from '@telesales/shared';
import {
  type LucideIcon,
  CalendarCheck,
  ClipboardCheck,
  CopyCheck,
  FileWarning,
  ListPlus,
  MessageSquareWarning,
  PhoneCall,
  UserCheck,
} from 'lucide-react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { cn } from '@/components/ui/cn';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { useHomeSummary } from '@/features/dashboard/api';
import { formatShortDate, todayJst } from '@/lib/format';
import { ja } from '@/i18n/ja';
import { MenuCard } from './MenuCard';
import { adminMenu, mainMenu, type MenuItem, visibleItems } from './menus';

function MenuGrid({ items }: { items: MenuItem[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.key}>
          <MenuCard item={item} />
        </li>
      ))}
    </ul>
  );
}

interface Task {
  key: string;
  label: string;
  count: number;
  to: string;
  icon: LucideIcon;
  urgent?: boolean;
}

function TaskTile({ task }: { task: Task }) {
  return (
    <Link
      to={task.to}
      className={cn(
        'flex items-center gap-3 rounded-(--radius-card) border bg-surface p-4 shadow-(--shadow-card) transition-colors hover:border-main/50',
        task.urgent && task.count > 0 ? 'border-danger/40' : 'border-line',
      )}
    >
      <task.icon
        aria-hidden="true"
        className={cn(
          'size-6 shrink-0',
          task.urgent && task.count > 0 ? 'text-danger' : 'text-main',
        )}
      />
      <span className="min-w-0 flex-1 text-sm font-bold">{task.label}</span>
      <span
        className={cn('text-2xl font-bold tabular-nums', task.count === 0 && 'text-ink-disabled')}
      >
        {task.count}
      </span>
    </Link>
  );
}

/** Home: what needs this person's attention, then the modules (decided by permissions). */
export function HomePage() {
  const { permissions } = useCurrentUser();
  const summary = useHomeSummary();
  const main = visibleItems(mainMenu, permissions);
  const admin = visibleItems(adminMenu, permissions);
  const can = (permission: Permission) => permissions.includes(permission);
  const data = summary.data;

  const tasks: Task[] = data
    ? [
        ...(can(Permission.WorkOnAppointments)
          ? [
              {
                key: 'today',
                label: '今日の予定',
                count: data.todayPlans,
                to: `${paths.schedule}?view=day&date=${todayJst()}`,
                icon: CalendarCheck,
              },
              {
                key: 'confirm',
                label: '確認していないアポ',
                count: data.unconfirmedAppointments,
                to: paths.appointments,
                icon: UserCheck,
                urgent: true,
              },
              {
                key: 'results',
                label: '結果を入れていないアポ',
                count: data.missingResults,
                to: paths.appointments,
                icon: FileWarning,
                urgent: true,
              },
            ]
          : []),
        ...(can(Permission.WriteDayBeforeChecks)
          ? [
              {
                key: 'dayBefore',
                label: `前日確認（${formatShortDate(data.dayBeforeDate)}〜）`,
                count: data.dayBeforePending,
                to: paths.dayBefore,
                icon: ClipboardCheck,
                urgent: true,
              },
            ]
          : []),
        ...(can(Permission.HandleChangeRequests)
          ? [
              {
                key: 'requests',
                label: '未対応の変更依頼',
                count: data.openChangeRequests,
                to: paths.changeRequests,
                icon: MessageSquareWarning,
                urgent: true,
              },
            ]
          : []),
        ...(can(Permission.WriteCallRecords)
          ? [
              {
                key: 'lists',
                label: '新しい架電リスト（7日間）',
                count: data.newCallLists,
                to: paths.callsImports,
                icon: ListPlus,
              },
            ]
          : []),
        ...(can(Permission.ResolveDuplicates)
          ? [
              {
                key: 'dups',
                label: '重複・要確認',
                count: data.duplicatesToResolve,
                to: paths.callsDuplicates,
                icon: CopyCheck,
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="flex flex-col gap-10">
      {tasks.length > 0 && (
        <section aria-labelledby="tasks-title">
          <h1 id="tasks-title" className="mb-4 text-2xl font-bold">
            今日やること
          </h1>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tasks.map((task) => (
              <li key={task.key}>
                <TaskTile task={task} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="home-title">
        <h2 id="home-title" className="mb-4 text-lg font-bold">
          {ja.home.title}
        </h2>
        <MenuGrid items={main} />
        {can(Permission.WriteCallRecords) && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-sub">
            <PhoneCall className="size-4" aria-hidden="true" />
            架電は「{ja.module.calls}」から企業を開いて始めます。
          </p>
        )}
      </section>
      {admin.length > 0 && (
        <section aria-labelledby="admin-title">
          <h2 id="admin-title" className="mb-4 text-lg font-bold">
            {ja.admin.title}
          </h2>
          <MenuGrid items={admin} />
        </section>
      )}
    </div>
  );
}
