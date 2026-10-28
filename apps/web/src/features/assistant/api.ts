import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ApiErrorBody,
  type AssistantActionHistoryItem,
  type AssistantChatRequest,
  type AssistantConversationDto,
  type AssistantConversationSummary,
  type AssistantDecisionResult,
  type AssistantStreamEvent,
  CSRF_HEADER,
  CSRF_HEADER_VALUE,
} from '@telesales/shared';
import { apiClient } from '@/lib/api/ApiClient';
import { ApiError } from '@/lib/api/ApiError';

const keys = {
  status: ['assistant', 'status'] as const,
  conversations: ['assistant', 'conversations'] as const,
  conversation: (id: string) => ['assistant', 'conversation', id] as const,
  actions: ['assistant', 'actions'] as const,
};

export function useAssistantStatus() {
  return useQuery({
    queryKey: keys.status,
    queryFn: ({ signal }) => apiClient.get<{ enabled: boolean }>('/assistant/status', signal),
    staleTime: 5 * 60_000,
  });
}

export function useConversations(enabled: boolean) {
  return useQuery({
    queryKey: keys.conversations,
    queryFn: ({ signal }) =>
      apiClient.get<AssistantConversationSummary[]>('/assistant/conversations', signal),
    enabled,
  });
}

export function useActionHistory(enabled: boolean) {
  return useQuery({
    queryKey: keys.actions,
    queryFn: ({ signal }) =>
      apiClient.get<AssistantActionHistoryItem[]>('/assistant/actions', signal),
    enabled,
  });
}

export function fetchConversation(id: string) {
  return apiClient.get<AssistantConversationDto>(`/assistant/conversations/${id}`);
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<null>(`/assistant/conversations/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.conversations });
      void queryClient.invalidateQueries({ queryKey: keys.actions });
    },
  });
}

/** 確定 or やめる on a card; 確定 changes data the screens show, so they refresh. */
export function useDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'confirm' | 'dismiss' }) =>
      apiClient.post<AssistantDecisionResult>(`/assistant/actions/${id}/${decision}`),
    onSuccess: (_data, { decision }) => {
      if (decision === 'confirm') void queryClient.invalidateQueries();
      else void queryClient.invalidateQueries({ queryKey: ['assistant'] });
    },
  });
}

export function useRefreshHistory() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: keys.conversations });
    void queryClient.invalidateQueries({ queryKey: keys.actions });
  };
}

/**
 * Sends one message and reads MoraBot's work as it happens: the server writes one JSON
 * event per line (conversation, each step, then the answer).
 */
export async function streamChat(
  request: AssistantChatRequest,
  onEvent: (event: AssistantStreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.BASE_URL}api/assistant/chat`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/x-ndjson',
        'Content-Type': 'application/json',
        [CSRF_HEADER]: CSRF_HEADER_VALUE,
      },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR');
  }
  if (!response.ok || !response.body) {
    const payload: unknown = await response.json().catch(() => undefined);
    const body = (payload as ApiErrorBody | undefined)?.error;
    throw new ApiError(response.status, body?.code ?? 'UNKNOWN', body?.fields, body?.details);
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onEvent(JSON.parse(line) as AssistantStreamEvent);
      newline = buffer.indexOf('\n');
    }
  }
}
