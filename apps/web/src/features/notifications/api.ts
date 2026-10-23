import type { NotificationListResponse } from '@telesales/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, toQuery } from '@/lib/api/ApiClient';

const key = ['notifications'] as const;

export type NoticeBox = 'inbox' | 'unread' | 'archived';

/** The bell: the newest inbox notices and the unread count. */
export function useNotifications() {
  return useQuery({
    queryKey: [...key, 'bell'],
    queryFn: ({ signal }) => apiClient.get<NotificationListResponse>('/notifications', signal),
    refetchInterval: 30_000,
  });
}

/** The activity page: a box, search and type filter, loaded page by page. */
export function useNotificationFeed(filter: { box: NoticeBox; q: string; codes: string[] }) {
  return useInfiniteQuery({
    queryKey: [...key, 'feed', filter.box, filter.q, filter.codes.join(',')],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      apiClient.get<NotificationListResponse>(
        `/notifications${toQuery({
          box: filter.box,
          q: filter.q || undefined,
          codes: filter.codes.length ? filter.codes.join(',') : undefined,
          before: pageParam,
        })}`,
        signal,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 30_000,
  });
}

function useNoticeMutation<T>(fn: (input: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void client.invalidateQueries({ queryKey: key }),
  });
}

export function useMarkRead() {
  return useNoticeMutation((ids: string[] | 'all') =>
    apiClient.post<undefined>('/notifications/read', { ids }),
  );
}

export function useMarkUnread() {
  return useNoticeMutation((ids: string[]) =>
    apiClient.post<undefined>('/notifications/unread', { ids }),
  );
}

export function useArchive() {
  return useNoticeMutation(({ ids, archived }: { ids: string[] | 'read'; archived: boolean }) =>
    apiClient.post<undefined>('/notifications/archive', { ids, archived }),
  );
}
