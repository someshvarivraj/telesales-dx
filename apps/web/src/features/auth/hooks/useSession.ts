import type { ChangePasswordRequest, LoginRequest, SessionUser } from '@telesales/shared';
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/AuthApi';

export const sessionQueryKey = ['auth', 'session'] as const;

export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: ({ signal }) => authApi.fetchSession(signal),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** The signed-in user. Only call inside routes protected by RequireSession. */
export function useCurrentUser(): SessionUser {
  const { data } = useSession();
  if (!data) {
    throw new Error('useCurrentUser must be used inside a protected route');
  }
  return data;
}

/**
 * Puts the signed-in user in the cache. A "who is signed in?" request that started before
 * login (the login screen asks on load) is cancelled first: it was sent without the new
 * cookie, and its late "nobody" would otherwise overwrite the login and send the person back
 * to the login screen until they reloaded (report 11/12).
 */
async function storeSession(queryClient: QueryClient, user: SessionUser): Promise<void> {
  await queryClient.cancelQueries({ queryKey: sessionQueryKey });
  queryClient.setQueryData(sessionQueryKey, user);
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: LoginRequest) => authApi.login(request),
    onSuccess: (user) => storeSession(queryClient, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(sessionQueryKey, null);
    },
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ChangePasswordRequest) => authApi.changePassword(request),
    onSuccess: (user) => storeSession(queryClient, user),
  });
}
