import type { SystemStatusResponse } from '@telesales/shared';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/ApiClient';

/** Maintenance flag; checked every minute so a switch takes effect without a reload. */
export function useSystemStatus() {
  return useQuery({
    queryKey: ['system'],
    queryFn: ({ signal }) => apiClient.get<SystemStatusResponse>('/system/status', signal),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
