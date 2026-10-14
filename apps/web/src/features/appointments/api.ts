import type {
  AppointmentDetail,
  AppointmentFilePrefill,
  AppointmentListItem,
  AppointmentListQuery,
  CancelAppointmentRequest,
  ChangeRequestDto,
  ChangeRequestListItem,
  CreateAppointmentRequest,
  DayBeforeCheckRequest,
  EmailDraftDto,
  MeetingResultRequest,
  Page,
  RescheduleRequest,
  UpdateAppointmentDetailsRequest,
  UpdateEmailDraftRequest,
} from '@telesales/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, saveFile, toQuery } from '@/lib/api/ApiClient';

export type MailKind = 'booking' | 'cancellation' | 'dayBefore';

export const appointmentKeys = {
  all: ['appointments'] as const,
  list: (query: AppointmentListQuery) => ['appointments', 'list', query] as const,
  detail: (id: string) => ['appointments', 'detail', id] as const,
  dayBefore: (date?: string) => ['appointments', 'day-before', date ?? 'today'] as const,
  changeRequests: (open: boolean) => ['appointments', 'change-requests', open] as const,
};

export function useAppointments(query: AppointmentListQuery) {
  return useQuery({
    queryKey: appointmentKeys.list(query),
    queryFn: ({ signal }) =>
      apiClient.get<Page<AppointmentListItem>>(`/appointments${toQuery({ ...query })}`, signal),
    placeholderData: (previous) => previous,
  });
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: appointmentKeys.detail(id),
    queryFn: ({ signal }) => apiClient.get<AppointmentDetail>(`/appointments/${id}`, signal),
    enabled: Boolean(id),
  });
}

export function useDayBeforeList(date?: string) {
  return useQuery({
    queryKey: appointmentKeys.dayBefore(date),
    queryFn: ({ signal }) =>
      apiClient.get<{ checkDate: string; dates: string[]; items: AppointmentListItem[] }>(
        `/appointments/day-before${toQuery({ date })}`,
        signal,
      ),
  });
}

export function useChangeRequests(open: boolean) {
  return useQuery({
    queryKey: appointmentKeys.changeRequests(open),
    queryFn: ({ signal }) =>
      apiClient.get<ChangeRequestListItem[]>(`/change-requests${toQuery({ open })}`, signal),
  });
}

/** Every appointment mutation refreshes the shared caches (list, schedule, home). */
function useAppointmentMutation<TVariables, TResult>(
  fn: (variables: TVariables) => Promise<TResult>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      if (result && typeof result === 'object' && 'abilities' in result) {
        const detail = result as unknown as AppointmentDetail;
        client.setQueryData(appointmentKeys.detail(detail.id), detail);
      }
      void client.invalidateQueries({ queryKey: appointmentKeys.all });
      void client.invalidateQueries({ queryKey: ['schedule'] });
      void client.invalidateQueries({ queryKey: ['home'] });
    },
  });
}

export const useCreateAppointment = () =>
  useAppointmentMutation((request: CreateAppointmentRequest) =>
    apiClient.post<AppointmentDetail>('/appointments', request),
  );

export const useUpdateAppointment = (id: string) =>
  useAppointmentMutation((request: UpdateAppointmentDetailsRequest) =>
    apiClient.put<AppointmentDetail>(`/appointments/${id}`, request),
  );

export const useReschedule = (id: string) =>
  useAppointmentMutation((request: RescheduleRequest) =>
    apiClient.post<AppointmentDetail>(`/appointments/${id}/reschedule`, request),
  );

export const useCancelAppointment = (id: string) =>
  useAppointmentMutation((request: CancelAppointmentRequest) =>
    apiClient.post<AppointmentDetail>(`/appointments/${id}/cancel`, request),
  );

export const useConfirmAppointment = (id: string) =>
  useAppointmentMutation(() => apiClient.post<AppointmentDetail>(`/appointments/${id}/confirm`));

export const useMeetingUrl = (id: string) =>
  useAppointmentMutation((meetingUrl: string | null) =>
    apiClient.put<AppointmentDetail>(`/appointments/${id}/meeting-url`, { meetingUrl }),
  );

export const useAddPreparation = (id: string) =>
  useAppointmentMutation(({ note, files }: { note: string; files: File[] }) => {
    const form = new FormData();
    if (note) form.append('note', note);
    files.forEach((file) => form.append('files', file));
    return apiClient.upload<AppointmentDetail>(`/appointments/${id}/preparations`, form);
  });

export const useAddResult = (id: string) =>
  useAppointmentMutation((request: MeetingResultRequest) =>
    apiClient.post<AppointmentDetail>(`/appointments/${id}/results`, request),
  );

export const useRequestChange = (id: string) =>
  useAppointmentMutation((message: string) =>
    apiClient.post<AppointmentDetail>(`/appointments/${id}/change-requests`, { message }),
  );

export const useDayBeforeCheck = () =>
  useAppointmentMutation(({ id, request }: { id: string; request: DayBeforeCheckRequest }) =>
    apiClient.put<AppointmentDetail>(`/appointments/${id}/day-before`, request),
  );

export const useChangeRequestAction = () =>
  useAppointmentMutation(({ id, action }: { id: string; action: 'take' | 'done' | 'withdraw' }) =>
    apiClient.post<ChangeRequestDto>(`/change-requests/${id}/${action}`),
  );

export function usePrefill() {
  return useMutation({
    mutationFn: ({ files, rowIndex }: { files: File[]; rowIndex?: number }) => {
      const form = new FormData();
      files.forEach((file) => form.append('files', file));
      if (rowIndex !== undefined) form.append('rowIndex', String(rowIndex));
      return apiClient.upload<AppointmentFilePrefill>('/appointments/file-prefill', form);
    },
  });
}

export function useMailDraft(appointmentId: string, kind: MailKind) {
  return useQuery({
    queryKey: ['appointments', 'mail', appointmentId, kind],
    queryFn: () =>
      apiClient.post<EmailDraftDto>(`/appointments/${appointmentId}/emails/${kind}/draft`),
    staleTime: Infinity,
    retry: false,
  });
}

export function useMailActions(appointmentId: string, kind: MailKind) {
  const client = useQueryClient();
  const key = ['appointments', 'mail', appointmentId, kind];
  const onSuccess = (draft: EmailDraftDto) => {
    client.setQueryData(key, draft);
    void client.invalidateQueries({ queryKey: appointmentKeys.detail(appointmentId) });
  };
  return {
    save: useMutation({
      mutationFn: ({ id, request }: { id: string; request: UpdateEmailDraftRequest }) =>
        apiClient.put<EmailDraftDto>(`/appointments/${appointmentId}/emails/${id}`, request),
      onSuccess,
    }),
    send: useMutation({
      mutationFn: (id: string) =>
        apiClient.post<EmailDraftDto>(`/appointments/${appointmentId}/emails/${id}/send`),
      onSuccess,
    }),
    regenerate: useMutation({
      mutationFn: (id: string) =>
        apiClient.post<EmailDraftDto>(`/appointments/${appointmentId}/emails/${id}/regenerate`),
      onSuccess,
    }),
    resend: useMutation({
      mutationFn: () =>
        apiClient.post<EmailDraftDto>(`/appointments/${appointmentId}/emails/booking/resend`),
      onSuccess,
    }),
  };
}

export async function downloadReport(
  bookedFrom: string,
  bookedTo: string,
  bookedById?: string,
): Promise<void> {
  saveFile(
    await apiClient.download(
      `/appointments/report.xlsx${toQuery({ bookedFrom, bookedTo, bookedById })}`,
      'アポ取得一覧.xlsx',
    ),
  );
}

export async function downloadAppointmentFile(
  appointmentId: string,
  fileId: string,
  name: string,
): Promise<void> {
  saveFile(await apiClient.download(`/appointments/${appointmentId}/files/${fileId}`, name));
}
