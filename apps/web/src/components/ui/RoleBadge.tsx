import { Role } from '@telesales/shared';
import { ja } from '@/i18n/ja';
import { cn } from './cn';

const roleClass: Record<Role, string> = {
  [Role.Telema]: 'bg-role-telema-soft text-role-telema',
  [Role.Sales]: 'bg-role-sales-soft text-role-sales',
  [Role.Admin]: 'bg-role-admin-soft text-role-admin',
};

interface RoleBadgeProps {
  role: Role;
  isTeamLead?: boolean;
}

export function RoleBadge({ role, isTeamLead = false }: RoleBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          'rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap',
          roleClass[role],
        )}
      >
        {ja.role[role]}
      </span>
      {isTeamLead && (
        <span className="rounded-full border border-role-telema/40 px-2 py-0.5 text-xs font-bold whitespace-nowrap text-role-telema">
          {ja.role.lead}
        </span>
      )}
    </span>
  );
}
