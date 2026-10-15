import { Role, sortRoles } from '@telesales/shared';
import { ja } from '@/i18n/ja';
import { cn } from './cn';

const roleClass: Record<Role, string> = {
  [Role.Telema]: 'bg-role-telema-soft text-role-telema',
  [Role.TelemaLead]: 'border border-role-telema/40 text-role-telema',
  [Role.Sales]: 'bg-role-sales-soft text-role-sales',
  [Role.Viewer]: 'bg-role-viewer-soft text-role-viewer',
  [Role.Admin]: 'bg-role-admin-soft text-role-admin',
};

/** All roles of a user, most specific first (one user can hold several). */
export function RoleBadges({ roles }: { roles: readonly Role[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-1" aria-label="役割">
      {sortRoles(roles).map((role) => (
        <li
          key={role}
          className={cn('px-2 py-px text-xs font-medium whitespace-nowrap', roleClass[role])}
        >
          {ja.role[role]}
        </li>
      ))}
    </ul>
  );
}
