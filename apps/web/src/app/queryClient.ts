import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { sessionQueryKey } from '@/features/auth/hooks/useSession';
import { ApiError } from '@/lib/api/ApiError';

/**
 * Any 401 from the API means the session ended (timeout, logout elsewhere, deactivation).
 * Clearing the cached session lets RequireSession send the user back to login.
 */
export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (error) => handleAuthError(client, error) }),
    mutationCache: new MutationCache({ onError: (error) => handleAuthError(client, error) }),
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: true,
        retry: (failureCount, error) =>
          !(ApiError.isApiError(error) && error.status < 500) && failureCount < 2,
      },
    },
  });
  return client;
}

function handleAuthError(client: QueryClient, error: unknown): void {
  if (ApiError.isApiError(error) && error.isUnauthenticated) {
    client.setQueryData(sessionQueryKey, null);
  }
}
