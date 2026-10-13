import { ROLE_HOME_PATH } from '@telesales/shared';
import { Navigate } from 'react-router';
import { useCurrentUser } from '../hooks/useSession';

/** `/` sends each user to their role's home, based on the role stored in the database. */
export function RoleHomeRedirect() {
  const user = useCurrentUser();
  return <Navigate to={ROLE_HOME_PATH[user.role]} replace />;
}
