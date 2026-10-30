import type {
  CreateFeedbackRequest,
  FeedbackDto,
  FeedbackListResponse,
  FeedbackStatus,
  UpdateFeedbackRequest,
} from '@telesales/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, toQuery } from '@/lib/api/ApiClient';

export const feedbackKeys = {
  all: ['feedback'] as const,
  mine: ['feedback', 'mine'] as const,
  admin: (status?: FeedbackStatus) => ['feedback', 'admin', status ?? 'all'] as const,
};

export function useSendFeedback() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFeedbackRequest) => apiClient.post<FeedbackDto>('/feedback', input),
    onSuccess: () => void client.invalidateQueries({ queryKey: feedbackKeys.all }),
  });
}

export function useMyFeedback(enabled: boolean) {
  return useQuery({
    queryKey: feedbackKeys.mine,
    queryFn: ({ signal }) => apiClient.get<FeedbackDto[]>('/feedback/mine', signal),
    enabled,
  });
}

export function useAdminFeedback(status?: FeedbackStatus) {
  return useQuery({
    queryKey: feedbackKeys.admin(status),
    queryFn: ({ signal }) =>
      apiClient.get<FeedbackListResponse>(`/admin/feedback${toQuery({ status })}`, signal),
  });
}

export function useUpdateFeedback() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateFeedbackRequest & { id: string }) =>
      apiClient.put<FeedbackDto>(`/admin/feedback/${id}`, input),
    onSuccess: () => void client.invalidateQueries({ queryKey: feedbackKeys.all }),
  });
}
