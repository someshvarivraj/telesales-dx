import type { Role } from '@telesales/shared';
import type { ReactNode } from 'react';
import { ForbiddenPage } from '@/features/system/ForbiddenPage';
import { useCurrentUser } from '../hooks/useSession';

interface RequireRoleProps {
  role: Role;
  children: ReactNode;
}

/** Each role only sees its own area. The API enforces the same rule server-side. */
export function RequireRole({ role, children }: RequireRoleProps) {
  const user = useCurrentUser();
  return user.role === role ? children : <ForbiddenPage />;
}
