import type { NotificationListResponse } from '@telesales/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/ApiClient';

const key = ['notifications'] as const;

export function useNotifications() {
  return useQuery({
    queryKey: key,
    queryFn: ({ signal }) => apiClient.get<NotificationListResponse>('/notifications', signal),
    refetchInterval: 30_000,
  });
}

export function useMarkRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[] | 'all') =>
      apiClient.post<undefined>('/notifications/read', { ids }),
    onSuccess: () => void client.invalidateQueries({ queryKey: key }),
  });
}
