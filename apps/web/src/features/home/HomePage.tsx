import { Permission, Role } from '@telesales/shared';
import {
  type LucideIcon,
  CalendarCheck,
  CheckCheck,
  ListTodo,
  PhoneOutgoing,
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
import { MoraBot } from '@/components/brand/MoraBot';
import { Scene, type SceneName } from '@/components/illustrations/Scenes';
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
        'flex items-center gap-3 border bg-surface p-4 shadow-(--shadow-card) transition-colors hover:border-main-line hover:bg-main-soft/40',
        task.urgent && task.count > 0 ? 'border-danger/40' : 'border-line',
      )}
    >
      <task.icon
        aria-hidden="true"
        className={cn(
          'size-6 shrink-0',
          task.urgent && task.count > 0 ? 'text-danger' : 'text-ink-sub',
        )}
      />
      <span className="min-w-0 flex-1 text-sm font-medium">{task.label}</span>
      <span
        className={cn('text-2xl font-bold tabular-nums', task.count === 0 && 'text-ink-disabled')}
      >
        {task.count}
      </span>
    </Link>
  );
}

/** The home picture shows the person's own part of the work. */
function sceneFor(roles: readonly string[]): SceneName {
  if (roles.includes(Role.Admin)) return 'flow';
  if (roles.includes(Role.TelemaLead) || roles.includes(Role.Telema)) return 'calling';
  if (roles.includes(Role.Sales)) return 'schedule';
  return 'report';
}

/** Home: what needs this person's attention, then the modules (decided by permissions). */
export function HomePage() {
  const { permissions, name, roles } = useCurrentUser();
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
              {
                key: 'nextActions',
                label: '期限が来た次回アクション',
                count: data.nextActionsDue,
                to: paths.nextActions,
                icon: ListTodo,
                urgent: true,
              },
            ]
          : []),
        ...(can(Permission.ConfirmAllocation) && data.allocationToConfirm
          ? [
              {
                key: 'allocation',
                label: '今日の割り振りの確定',
                count: 1,
                to: paths.telemaAllocation,
                icon: CheckCheck,
                urgent: true,
              },
            ]
          : []),
        ...(can(Permission.WriteShifts) && data.myCalls + data.myDayBefore > 0
          ? [
              {
                key: 'myCalls',
                label: '今日の担当（架電）',
                count: data.myCalls,
                to: `${paths.calls}?mine=1`,
                icon: PhoneOutgoing,
              },
              {
                key: 'myDayBefore',
                label: '今日の担当（前日確認）',
                count: data.myDayBefore,
                to: `${paths.dayBefore}?mine=1`,
                icon: ClipboardCheck,
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

  const open = tasks.reduce((sum, task) => sum + task.count, 0);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center gap-4 overflow-hidden border border-line bg-surface px-6 py-5 shadow-(--shadow-card) max-sm:px-4">
        <MoraBot mood={data && open === 0 ? 'approved' : 'checking'} size={64} title="" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold">{name}さん、おつかれさまです。</p>
          <p className="text-sm text-ink-sub">
            {!data
              ? ja.common.loading
              : open === 0
                ? '今日やることは、いまはありません。'
                : `今日やることが ${open} 件あります。`}
          </p>
        </div>
        <Scene name={sceneFor(roles)} className="-my-3 w-60 shrink-0 max-sm:hidden" />
      </div>
      {tasks.length > 0 && (
        <section aria-labelledby="tasks-title">
          <h1 id="tasks-title" className="mb-3 text-lg font-bold">
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
