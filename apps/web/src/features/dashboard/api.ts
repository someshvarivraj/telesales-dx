import type { DashboardQuery, DashboardResponse, HomeSummaryResponse } from '@telesales/shared';
import { useQuery } from '@tanstack/react-query';
import { apiClient, toQuery } from '@/lib/api/ApiClient';

export function useDashboard(query: DashboardQuery) {
  return useQuery({
    queryKey: ['dashboard', query],
    queryFn: ({ signal }) =>
      apiClient.get<DashboardResponse>(`/dashboard${toQuery({ ...query })}`, signal),
    placeholderData: (previous) => previous,
  });
}

export function useHomeSummary() {
  return useQuery({
    queryKey: ['home'],
    queryFn: ({ signal }) => apiClient.get<HomeSummaryResponse>('/home', signal),
    refetchInterval: 60_000,
  });
}
