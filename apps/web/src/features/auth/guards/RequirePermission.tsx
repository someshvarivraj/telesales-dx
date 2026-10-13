import type { Permission } from '@telesales/shared';
import type { ReactNode } from 'react';
import { ForbiddenPage } from '@/features/system/ForbiddenPage';
import { useCurrentUser } from '../hooks/useSession';

interface RequirePermissionProps {
  /** The user needs at least one of these. */
  anyOf: readonly Permission[];
  children: ReactNode;
}

/** Screen-level guard for UX. The API enforces the same permissions on every request. */
export function RequirePermission({ anyOf, children }: RequirePermissionProps) {
  const user = useCurrentUser();
  return anyOf.some((permission) => user.permissions.includes(permission)) ? (
    children
  ) : (
    <ForbiddenPage />
  );
}
