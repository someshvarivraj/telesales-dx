import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { paths } from '@/app/paths';
import { FullPageSpinner } from '@/components/layout/FullPageSpinner';
import { useSession } from '../hooks/useSession';

interface RequireSessionProps {
  children: ReactNode;
  /** The change-password screen itself must stay reachable while a change is pending. */
  allowPendingPasswordChange?: boolean;
}

/** Redirects to login when signed out, and to the change-password screen when required. */
export function RequireSession({
  children,
  allowPendingPasswordChange = false,
}: RequireSessionProps) {
  const { data: user, isPending } = useSession();
  const location = useLocation();

  if (isPending) {
    return <FullPageSpinner />;
  }
  if (!user) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`${paths.login}?redirect=${redirect}`} replace />;
  }
  if (user.mustChangePassword && !allowPendingPasswordChange) {
    return <Navigate to={paths.changePassword} replace />;
  }
  return children;
}
