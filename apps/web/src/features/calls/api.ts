import type {
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
  Page,
  RepSuggestion,
  ResolveFlagRequest,
  UpdateCompanyRequest,
} from '@telesales/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, toQuery } from '@/lib/api/ApiClient';

export const callsKeys = {
  search: (request: unknown) => ['companies', 'search', request] as const,
  company: (id: string) => ['companies', id] as const,
  records: (id: string) => ['companies', id, 'call-records'] as const,
  imports: ['list-imports'] as const,
  flagged: ['companies', 'flagged'] as const,
  listNames: ['companies', 'list-names'] as const,
  comments: (target: { appointmentId?: string; callRecordId?: string }) =>
    ['comments', target] as const,
};

export function useCompanySearch(request: Partial<CompanySearchRequest>) {
  return useQuery({
    queryKey: callsKeys.search(request),
    queryFn: () => apiClient.post<Page<CompanyListItem>>('/companies/search', request),
    placeholderData: (previous) => previous,
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: callsKeys.company(id),
    queryFn: ({ signal }) => apiClient.get<CompanyDetail>(`/companies/${id}`, signal),
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

export function useCallRecords(companyId: string) {
  return useQuery({
    queryKey: callsKeys.records(companyId),
    queryFn: ({ signal }) =>
      apiClient.get<CallRecordDto[]>(`/companies/${companyId}/call-records`, signal),
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
    onSuccess: () => void client.invalidateQueries({ queryKey: ['companies'] }),
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
