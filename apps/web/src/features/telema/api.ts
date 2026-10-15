import type {
  AllocationDayResponse,
  FillShiftsRequest,
  FillShiftsResponse,
  MyAssignmentsResponse,
  ShiftDto,
  ShiftMonthResponse,
  ShiftRequest,
  TelemarketerDto,
  TelemarketerRequest,
  TodayStaffResponse,
  UsualHoursRequest,
} from '@telesales/shared';
import { type QueryKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, toQuery } from '@/lib/api/ApiClient';

export const telemaKeys = {
  all: ['telema'] as const,
  people: ['telema', 'people'] as const,
  shifts: (month: string) => ['telema', 'shifts', month] as const,
  staff: (date: string) => ['telema', 'staff', date] as const,
  allocation: (date: string) => ['telema', 'allocation', date] as const,
  mine: ['telema', 'allocation', 'mine'] as const,
};

/** Shifts, staff and allocation all depend on each other: refresh the whole section. */
function useTelemaMutation<TVariables, TResult>(
  fn: (variables: TVariables) => Promise<TResult>,
  extra: QueryKey[] = [],
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: telemaKeys.all });
      void client.invalidateQueries({ queryKey: ['home'] });
      extra.forEach((queryKey) => void client.invalidateQueries({ queryKey }));
    },
  });
}

export const useTelemarketers = () =>
  useQuery({
    queryKey: telemaKeys.people,
    queryFn: ({ signal }) => apiClient.get<TelemarketerDto[]>('/telema/people', signal),
  });

export const useUpdateTelemarketer = () =>
  useTelemaMutation(({ id, request }: { id: string; request: TelemarketerRequest }) =>
    apiClient.put<TelemarketerDto>(`/telema/people/${id}`, request),
  );

export const useUpdateOwnUsualHours = () =>
  useTelemaMutation((request: UsualHoursRequest) =>
    apiClient.put<TelemarketerDto>('/telema/me/usual-hours', request),
  );

export const useShiftMonth = (month: string) =>
  useQuery({
    queryKey: telemaKeys.shifts(month),
    queryFn: ({ signal }) =>
      apiClient.get<ShiftMonthResponse>(`/telema/shifts${toQuery({ month })}`, signal),
    placeholderData: (previous) => previous,
  });

export const useSaveShift = () =>
  useTelemaMutation((request: ShiftRequest) => apiClient.put<ShiftDto>('/telema/shifts', request));

export const useDeleteShift = () =>
  useTelemaMutation((id: string) => apiClient.delete<undefined>(`/telema/shifts/${id}`));

export const useFillShifts = () =>
  useTelemaMutation((request: FillShiftsRequest) =>
    apiClient.post<FillShiftsResponse>('/telema/shifts/fill', request),
  );

export const useStaff = (date: string) =>
  useQuery({
    queryKey: telemaKeys.staff(date),
    queryFn: ({ signal }) =>
      apiClient.get<TodayStaffResponse>(`/telema/staff${toQuery({ date })}`, signal),
  });

export const useAllocation = (date: string) =>
  useQuery({
    queryKey: telemaKeys.allocation(date),
    queryFn: ({ signal }) =>
      apiClient.get<AllocationDayResponse>(`/telema/allocations${toQuery({ date })}`, signal),
    placeholderData: (previous) => previous,
  });

export const useMyAssignments = () =>
  useQuery({
    queryKey: telemaKeys.mine,
    queryFn: ({ signal }) =>
      apiClient.get<MyAssignmentsResponse>('/telema/allocations/mine', signal),
  });

export const useCalculateAllocation = () =>
  useTelemaMutation((date: string) =>
    apiClient.post<{ calls: number; dayBefore: number }>('/telema/allocations/calculate', {
      date,
    }),
  );

export const useMoveAllocation = () =>
  useTelemaMutation((request: { date: string; ids: string[]; assigneeId: string }) =>
    apiClient.post<undefined>('/telema/allocations/move', request),
  );

export const useConfirmAllocation = () =>
  useTelemaMutation(
    (date: string) => apiClient.post<undefined>('/telema/allocations/confirm', { date }),
    [['appointments', 'day-before']],
  );
