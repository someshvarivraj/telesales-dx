import type {
  AdminUserDto,
  AppDto,
  CreateAppRequest,
  UpdateAppRequest,
  AppSettingsDto,
  AreaRuleDto,
  AreaRuleRequest,
  AuditLogQuery,
  AuditLogResponse,
  CalendarDayAdminDto,
  CompanyGroupDto,
  CompanyGroupRequest,
  CreateUserRequest,
  NoticeSettingDto,
  OptionDto,
  SlotLockDto,
  TemporaryPasswordResponse,
  UpdateUserRequest,
} from '@telesales/shared';
import { type QueryKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, toQuery } from '@/lib/api/ApiClient';

function useInvalidatingMutation<TVariables, TResult>(
  keys: QueryKey[],
  fn: (variables: TVariables) => Promise<TResult>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => keys.forEach((queryKey) => void client.invalidateQueries({ queryKey })),
  });
}

export const adminKeys = {
  users: ['admin', 'users'] as const,
  options: ['admin', 'options'] as const,
  calendar: (year: number) => ['admin', 'calendar', year] as const,
  notices: ['admin', 'notices'] as const,
  areaRules: ['admin', 'area-rules'] as const,
  groups: ['admin', 'company-groups'] as const,
  locks: ['admin', 'locks'] as const,
  settings: ['admin', 'settings'] as const,
  apps: ['admin', 'apps'] as const,
  audit: (query: AuditLogQuery) => ['admin', 'audit', query] as const,
};

export const useAdminUsers = () =>
  useQuery({
    queryKey: adminKeys.users,
    queryFn: ({ signal }) => apiClient.get<AdminUserDto[]>('/admin/users', signal),
  });

export const useCreateUser = () =>
  useInvalidatingMutation([adminKeys.users, ['people']], (request: CreateUserRequest) =>
    apiClient.post<TemporaryPasswordResponse>('/admin/users', request),
  );

export const useUpdateUser = () =>
  useInvalidatingMutation(
    [adminKeys.users, ['people']],
    ({ id, request }: { id: string; request: UpdateUserRequest }) =>
      apiClient.put<AdminUserDto>(`/admin/users/${id}`, request),
  );

export const useResetPassword = () =>
  useInvalidatingMutation([adminKeys.users], (id: string) =>
    apiClient.post<TemporaryPasswordResponse>(`/admin/users/${id}/reset-password`),
  );

export const useUnlockUser = () =>
  useInvalidatingMutation([adminKeys.users], (id: string) =>
    apiClient.post<AdminUserDto>(`/admin/users/${id}/unlock`),
  );

export const useAdminOptions = () =>
  useQuery({
    queryKey: adminKeys.options,
    queryFn: ({ signal }) => apiClient.get<OptionDto[]>('/admin/options', signal),
  });

export const useCreateOption = () =>
  useInvalidatingMutation(
    [adminKeys.options, ['options']],
    (request: { category: string; code: string; label: string }) =>
      apiClient.post<OptionDto>('/admin/options', request),
  );

export const useUpdateOption = () =>
  useInvalidatingMutation(
    [adminKeys.options, ['options']],
    ({
      id,
      request,
    }: {
      id: string;
      request: { label: string; isActive: boolean; sortOrder: number };
    }) => apiClient.put<OptionDto>(`/admin/options/${id}`, request),
  );

export const useAdminCalendar = (year: number) =>
  useQuery({
    queryKey: adminKeys.calendar(year),
    queryFn: ({ signal }) =>
      apiClient.get<CalendarDayAdminDto[]>(`/admin/calendar${toQuery({ year })}`, signal),
  });

export const useAddCompanyHoliday = () =>
  useInvalidatingMutation(
    [['admin', 'calendar'], ['calendar'], ['schedule']],
    (request: { date: string; name: string }) =>
      apiClient.post<CalendarDayAdminDto>('/admin/calendar/company-holidays', request),
  );

export const useRemoveCompanyHoliday = () =>
  useInvalidatingMutation([['admin', 'calendar'], ['calendar'], ['schedule']], (date: string) =>
    apiClient.delete<undefined>(`/admin/calendar/company-holidays/${date}`),
  );

export const useImportHolidays = () =>
  useInvalidatingMutation(
    [['admin', 'calendar'], ['calendar'], ['schedule']],
    ({ year, file }: { year: number; file?: File }) => {
      const form = new FormData();
      form.append('year', String(year));
      if (file) form.append('file', file);
      return apiClient.upload<{ imported: number }>('/admin/calendar/public-holidays', form);
    },
  );

export const useNoticeSettings = () =>
  useQuery({
    queryKey: adminKeys.notices,
    queryFn: ({ signal }) => apiClient.get<NoticeSettingDto[]>('/admin/notices', signal),
  });

export const useUpdateNotice = () =>
  useInvalidatingMutation(
    [adminKeys.notices],
    ({
      code,
      request,
    }: {
      code: string;
      request: {
        isEnabled: boolean;
        sendsEmail: boolean;
        sendTime: string | null;
        daysBefore: number[];
      };
    }) => apiClient.put<NoticeSettingDto>(`/admin/notices/${code}`, request),
  );

export const useAddRecipient = () =>
  useInvalidatingMutation(
    [adminKeys.notices],
    ({
      code,
      request,
    }: {
      code: string;
      request: { field: 'TO' | 'CC'; kind: string; value: string };
    }) => apiClient.post<NoticeSettingDto>(`/admin/notices/${code}/recipients`, request),
  );

export const useRemoveRecipient = () =>
  useInvalidatingMutation([adminKeys.notices], ({ code, id }: { code: string; id: string }) =>
    apiClient.delete<NoticeSettingDto>(`/admin/notices/${code}/recipients/${id}`),
  );

export const useAreaRules = () =>
  useQuery({
    queryKey: adminKeys.areaRules,
    queryFn: ({ signal }) => apiClient.get<AreaRuleDto[]>('/admin/area-rules', signal),
  });

export const useSaveAreaRule = () =>
  useInvalidatingMutation(
    [adminKeys.areaRules],
    ({ id, request }: { id?: string; request: AreaRuleRequest }) =>
      id
        ? apiClient.put<AreaRuleDto>(`/admin/area-rules/${id}`, request)
        : apiClient.post<AreaRuleDto>('/admin/area-rules', request),
  );

export const useDeleteAreaRule = () =>
  useInvalidatingMutation([adminKeys.areaRules], (id: string) =>
    apiClient.delete<undefined>(`/admin/area-rules/${id}`),
  );

export const useCompanyGroups = () =>
  useQuery({
    queryKey: adminKeys.groups,
    queryFn: ({ signal }) => apiClient.get<CompanyGroupDto[]>('/admin/company-groups', signal),
  });

export const useSaveCompanyGroup = () =>
  useInvalidatingMutation(
    [adminKeys.groups, adminKeys.areaRules],
    ({ id, request }: { id?: string; request: CompanyGroupRequest }) =>
      id
        ? apiClient.put<CompanyGroupDto>(`/admin/company-groups/${id}`, request)
        : apiClient.post<CompanyGroupDto>('/admin/company-groups', request),
  );

export const useAdminLocks = () =>
  useQuery({
    queryKey: adminKeys.locks,
    queryFn: ({ signal }) => apiClient.get<SlotLockDto[]>('/admin/slot-locks', signal),
    refetchInterval: 15_000,
  });

export const useReleaseLock = () =>
  useInvalidatingMutation([adminKeys.locks, ['schedule']], (id: string) =>
    apiClient.delete<undefined>(`/admin/slot-locks/${id}`),
  );

export const useAdminSettings = () =>
  useQuery({
    queryKey: adminKeys.settings,
    queryFn: ({ signal }) => apiClient.get<AppSettingsDto>('/admin/settings', signal),
  });

export const useSaveSettings = () =>
  useInvalidatingMutation([adminKeys.settings, ['settings']], (request: AppSettingsDto) =>
    apiClient.put<AppSettingsDto>('/admin/settings', request),
  );

export const useApps = () =>
  useQuery({
    queryKey: adminKeys.apps,
    queryFn: ({ signal }) => apiClient.get<AppDto[]>('/admin/apps', signal),
  });

export const useCreateApp = () =>
  useInvalidatingMutation([adminKeys.apps], (request: CreateAppRequest) =>
    apiClient.post<AppDto>('/admin/apps', request),
  );

export const useUpdateApp = () =>
  useInvalidatingMutation(
    [adminKeys.apps, ['system']],
    ({ key, request }: { key: string; request: UpdateAppRequest }) =>
      apiClient.put<AppDto>(`/admin/apps/${key}`, request),
  );

export const useAuditLog = (query: AuditLogQuery) =>
  useQuery({
    queryKey: adminKeys.audit(query),
    queryFn: ({ signal }) =>
      apiClient.get<AuditLogResponse>(`/admin/audit-logs${toQuery(query)}`, signal),
  });
