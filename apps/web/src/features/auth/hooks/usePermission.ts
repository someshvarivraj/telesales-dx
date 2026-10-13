import type { Permission } from '@telesales/shared';
import { useCurrentUser } from './useSession';

/** True when the signed-in user has the permission (roles + individual grants). */
export function usePermission(permission: Permission): boolean {
  return useCurrentUser().permissions.includes(permission);
}
