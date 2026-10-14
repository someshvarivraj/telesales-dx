import type { ErrorCode } from '@telesales/shared';

/** Error raised for any non-2xx API response or network failure. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR' | 'UNKNOWN',
    readonly fields: Record<string, string[]> = {},
    /** Extra context from the server, e.g. who holds a lock or why a slot is unavailable. */
    readonly details?: unknown,
  ) {
    super(`API request failed: ${status} ${code}`);
    this.name = 'ApiError';
  }

  get isUnauthenticated(): boolean {
    return this.status === 401 && this.code === 'UNAUTHENTICATED';
  }

  static isApiError(value: unknown): value is ApiError {
    return value instanceof ApiError;
  }
}
