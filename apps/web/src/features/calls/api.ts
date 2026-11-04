import type {
  AvoidListImportResult,
  AvoidPhoneDto,
  CallRecordDto,
  CommentDto,
  CommitListImportRequest,
  CompanyDetail,
  CompanyListItem,
  CompanySearchRequest,
  CreateCallRecordRequest,
  CreateCommentRequest,
  FindRepRequest,
  ListImportDto,
  ListImportPreview,
  ListImportRowDto,
  ListImportRowStatus,
  Page,
  RepSuggestion,
  ResolveFlagRequest,
  SetCallTargetRequest,
  SetCallTargetResult,
  GroupDepartmentsRequest,
  UpdateCompanyRequest,
} from '@telesales/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, saveFile, toQuery } from '@/lib/api/ApiClient';

export const callsKeys = {
  search: (request: unknown) => ['companies', 'search', request] as const,
  company: (id: string) => ['companies', id] as const,
  records: (id: string) => ['companies', id, 'call-records'] as const,
  imports: ['list-imports'] as const,
  importRows: (id: string, status: string) => ['list-imports', id, 'rows', status] as const,
  flagged: ['companies', 'flagged'] as const,
  listNames: ['companies', 'list-names'] as const,
  avoid: (keyword: string) => ['avoid-phones', keyword] as const,
  comments: (target: { appointmentId?: string; callRecordId?: string }) =>
    ['comments', target] as const,
};

export function useCompanySearch(
  request: Partial<CompanySearchRequest>,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: callsKeys.search(request),
    queryFn: () => apiClient.post<Page<CompanyListItem>>('/companies/search', request),
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: callsKeys.company(id),
    queryFn: ({ signal }) => apiClient.get<CompanyDetail>(`/companies/${id}`, signal),
    enabled: Boolean(id),
  });
}

/** Cities registered so far, for 住所 in 詳細検索. */
export function useCityNames() {
  return useQuery({
    queryKey: ['companies', 'city-names'] as const,
    queryFn: ({ signal }) => apiClient.get<string[]>('/companies/city-names', signal),
    staleTime: 5 * 60_000,
  });
}

export function useListNames() {
  return useQuery({
    queryKey: callsKeys.listNames,
    queryFn: ({ signal }) => apiClient.get<string[]>('/companies/list-names', signal),
  });
}

export function useUpdateCompany(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: UpdateCompanyRequest) =>
      apiClient.put<CompanyDetail>(`/companies/${id}`, request),
    onSuccess: (company) => client.setQueryData(callsKeys.company(id), company),
  });
}

export function useSaveTelemaMemo(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (telemaMemo: string | null) =>
      apiClient.put<CompanyDetail>(`/companies/${id}/telema-memo`, { telemaMemo }),
    onSuccess: (company) => client.setQueryData(callsKeys.company(id), company),
  });
}

export function useCallRecords(companyId: string) {
  return useQuery({
    queryKey: callsKeys.records(companyId),
    queryFn: ({ signal }) =>
      apiClient.get<CallRecordDto[]>(`/companies/${companyId}/call-records`, signal),
    enabled: Boolean(companyId),
  });
}

export function useSaveCallRecord(companyId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id?: string; request: CreateCallRecordRequest }) =>
      id
        ? apiClient.put<CallRecordDto>(`/call-records/${id}`, request)
        : apiClient.post<CallRecordDto>(`/companies/${companyId}/call-records`, request),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: callsKeys.records(companyId) });
      void client.invalidateQueries({ queryKey: ['companies', 'search'] });
    },
  });
}

export function useFindRep() {
  return useMutation({
    mutationFn: (request: FindRepRequest) =>
      apiClient.post<RepSuggestion>('/companies/find-rep', request),
  });
}

export function useListImports() {
  return useQuery({
    queryKey: callsKeys.imports,
    queryFn: ({ signal }) => apiClient.get<ListImportDto[]>('/list-imports', signal),
  });
}

/** The rows of one import as read and judged; `status` empty = all rows. */
export function useImportRows(id: string | null, status: ListImportRowStatus | '') {
  return useQuery({
    queryKey: callsKeys.importRows(id ?? '', status),
    queryFn: ({ signal }) =>
      apiClient.get<ListImportRowDto[]>(
        `/list-imports/${id}/rows${toQuery({ status: status || undefined })}`,
        signal,
      ),
    enabled: id !== null,
  });
}

export function usePreviewImport() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiClient.upload<ListImportPreview>('/list-imports/preview', form);
    },
  });
}

export function useCommitImport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: CommitListImportRequest) =>
      apiClient.post<ListImportDto>('/list-imports', request),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['companies'] });
      void client.invalidateQueries({ queryKey: callsKeys.imports });
    },
  });
}

export function useFlaggedCompanies(enabled: boolean) {
  return useQuery({
    queryKey: callsKeys.flagged,
    queryFn: ({ signal }) => apiClient.get<CompanyDetail[]>('/companies/flagged', signal),
    enabled,
  });
}

export function useResolveFlag() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: ResolveFlagRequest }) =>
      apiClient.post<CompanyDetail>(`/companies/${id}/resolve-flag`, request),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['companies'] });
      void client.invalidateQueries({ queryKey: callsKeys.imports });
    },
  });
}

export function useComments(
  target: { appointmentId?: string; callRecordId?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: callsKeys.comments(target),
    queryFn: ({ signal }) => apiClient.get<CommentDto[]>(`/comments${toQuery(target)}`, signal),
    enabled,
  });
}

export function useAddComment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateCommentRequest) => apiClient.post<CommentDto>('/comments', request),
    onSuccess: (_comment, request) => {
      void client.invalidateQueries({ queryKey: ['comments'] });
      if (request.callRecordId) void client.invalidateQueries({ queryKey: ['companies'] });
    },
  });
}

/** 架電結果のExcel (Sano 10/24 No.7). */
export async function downloadCallResults(filter: {
  from: string;
  to: string;
  telemarketerId: string;
  listName: string;
}): Promise<void> {
  saveFile(
    await apiClient.download(
      `/call-records/export.xlsx${toQuery({
        from: filter.from,
        to: filter.to,
        telemarketerId: filter.telemarketerId || undefined,
        listName: filter.listName || undefined,
      })}`,
      '架電結果.xlsx',
    ),
  );
}

/** 回避企業 (Sano 10/28 ⑥, 10/30). */
export function useAvoidList(keyword: string) {
  return useQuery({
    queryKey: callsKeys.avoid(keyword),
    queryFn: ({ signal }) =>
      apiClient.get<AvoidPhoneDto[]>(
        `/avoid-phones${toQuery({ keyword: keyword || undefined })}`,
        signal,
      ),
  });
}

function useAvoidInvalidation() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ['avoid-phones'] });
    void client.invalidateQueries({ queryKey: ['companies'] });
  };
}

export function useImportAvoidList() {
  const invalidate = useAvoidInvalidation();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiClient.upload<AvoidListImportResult>('/avoid-phones/import', form);
    },
    onSuccess: invalidate,
  });
}

export function useRemoveAvoidPhone() {
  const invalidate = useAvoidInvalidation();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<unknown>(`/avoid-phones/${id}`),
    onSuccess: invalidate,
  });
}

/** 「回避企業に追加」 on the call screen, and (lead / admin) taking it back off. */
export function useCompanyAvoid(companyId: string) {
  const invalidate = useAvoidInvalidation();
  return useMutation({
    mutationFn: async (avoid: boolean) => {
      if (avoid) {
        await apiClient.post<AvoidPhoneDto>(`/companies/${companyId}/avoid`, {});
      } else {
        await apiClient.delete<unknown>(`/companies/${companyId}/avoid`);
      }
    },
    onSuccess: invalidate,
  });
}

/** 架電対象 ⇄ 架電対象外 (request 11/2). */
export function useSetCallTargets() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: SetCallTargetRequest) =>
      apiClient.post<SetCallTargetResult>('/companies/call-targets', request),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['companies'] }),
  });
}

/** Group same-name companies as departments of one company, or take one out (request 11/2). */
export function useCompanyGroup(companyId: string) {
  const client = useQueryClient();
  const onSuccess = () => void client.invalidateQueries({ queryKey: ['companies'] });
  return {
    group: useMutation({
      mutationFn: (request: GroupDepartmentsRequest) =>
        apiClient.post<CompanyDetail>(`/companies/${companyId}/departments`, request),
      onSuccess,
    }),
    ungroup: useMutation({
      mutationFn: () => apiClient.delete<CompanyDetail>(`/companies/${companyId}/department`),
      onSuccess,
    }),
  };
}

/** 取り込みを取り消す (request 11/2). */
export function useUndoImport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete<{ removedCompanies: number; keptCompanies: number }>(`/list-imports/${id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['companies'] });
      void client.invalidateQueries({ queryKey: callsKeys.imports });
    },
  });
}
