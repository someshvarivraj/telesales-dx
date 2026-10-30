import type { HomeSummaryResponse } from '@telesales/shared';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/ApiClient';

/** 今日やること: the counts on the home screen and the tabs' badges. */
export function useHomeSummary() {
  return useQuery({
    queryKey: ['home'],
    queryFn: ({ signal }) => apiClient.get<HomeSummaryResponse>('/home', signal),
    refetchInterval: 60_000,
  });
}
