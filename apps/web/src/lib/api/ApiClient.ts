import { type ApiErrorBody, CSRF_HEADER, CSRF_HEADER_VALUE } from '@telesales/shared';
import { ApiError } from './ApiError';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Thin, typed wrapper around fetch for the same-origin API.
 * Sends the session cookie and the CSRF header, and normalises errors to ApiError.
 */
export class ApiClient {
  constructor(private readonly baseUrl = '/api') {}

  get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', path, undefined, signal);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(
    method: Method,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          [CSRF_HEADER]: CSRF_HEADER_VALUE,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      throw new ApiError(0, 'NETWORK_ERROR');
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const errorBody = (payload as ApiErrorBody | undefined)?.error;
      throw new ApiError(response.status, errorBody?.code ?? 'UNKNOWN', errorBody?.fields);
    }
    return payload as T;
  }
}

export const apiClient = new ApiClient();
