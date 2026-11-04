import type { SystemStatusResponse } from '@telesales/shared';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/ApiClient';

/**
 * Maintenance flag; checked every minute so a switch takes effect without a reload, and more
 * often while the server cannot be reached, to notice soon that it is back.
 */
export function useSystemStatus() {
  return useQuery({
    queryKey: ['system'],
    queryFn: ({ signal }) => apiClient.get<SystemStatusResponse>('/system/status', signal),
    refetchInterval: (query) => (query.state.error ? 15_000 : 60_000),
    staleTime: 30_000,
  });
}
