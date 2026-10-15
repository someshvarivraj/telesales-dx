import type {
  PlanDto,
  PlanRequest,
  ScheduleResponse,
  SlotCheckResult,
  SlotLockDto,
  TimeOffDto,
  TimeOffRequest,
} from '@telesales/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, toQuery } from '@/lib/api/ApiClient';

export const scheduleKeys = {
  all: ['schedule'] as const,
  range: (from: string, to: string, userIds: string[]) =>
    ['schedule', from, to, userIds.join(',')] as const,
};

export function useSchedule(from: string, to: string, userIds: string[]) {
  return useQuery({
    queryKey: scheduleKeys.range(from, to, userIds),
    queryFn: ({ signal }) =>
      apiClient.get<ScheduleResponse>(`/schedule${toQuery({ from, to, userIds })}`, signal),
    placeholderData: (previous) => previous,
    // Others book and lock slots too: keep the view fresh.
    refetchInterval: 30_000,
  });
}

export interface SlotCheckInput {
  salesRepId: string;
  startsAt: string;
  endsAt: string;
  kind: 'APPOINTMENT' | 'PLAN';
  appointmentId?: string | null;
  planId?: string | null;
  holidayWork?: boolean;
}

export function useSlotCheck(input: SlotCheckInput | null) {
  return useQuery({
    queryKey: ['slot-check', input],
    queryFn: () => apiClient.post<SlotCheckResult>('/schedule/check', input),
    enabled: input !== null,
    staleTime: 5_000,
  });
}

function useInvalidateSchedule() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: scheduleKeys.all });
    void client.invalidateQueries({ queryKey: ['home'] });
  };
}

export function useSavePlan() {
  const invalidate = useInvalidateSchedule();
  return useMutation({
    mutationFn: ({
      id,
      request,
    }: {
      id?: string;
      request: PlanRequest;
    }): Promise<PlanDto | PlanDto[]> =>
      id
        ? apiClient.put<PlanDto>(`/plans/${id}`, request)
        : apiClient.post<PlanDto[]>('/plans', request),
    onSuccess: invalidate,
  });
}

export function useDeletePlan() {
  const invalidate = useInvalidateSchedule();
  return useMutation({
    mutationFn: ({ id, series }: { id: string; series: boolean }) =>
      apiClient.delete<undefined>(`/plans/${id}${toQuery({ series })}`),
    onSuccess: invalidate,
  });
}

export function useConfirmCandidate() {
  const invalidate = useInvalidateSchedule();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<PlanDto>(`/plans/${id}/confirm-candidate`),
    onSuccess: invalidate,
  });
}

export function useSaveTimeOff() {
  const invalidate = useInvalidateSchedule();
  return useMutation({
    mutationFn: (request: TimeOffRequest) => apiClient.post<TimeOffDto>('/time-off', request),
    onSuccess: invalidate,
  });
}

export function useDeleteTimeOff() {
  const invalidate = useInvalidateSchedule();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<undefined>(`/time-off/${id}`),
    onSuccess: invalidate,
  });
}

export const slotLockApi = {
  acquire: (salesRepId: string, startsAt: string, endsAt: string) =>
    apiClient.post<SlotLockDto>('/slot-locks', { salesRepId, startsAt, endsAt }),
  heartbeat: (id: string) => apiClient.put<SlotLockDto>(`/slot-locks/${id}`),
  release: (id: string) => apiClient.delete<undefined>(`/slot-locks/${id}`),
};
