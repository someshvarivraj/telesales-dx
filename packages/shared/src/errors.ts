/** Machine-readable error codes returned by the API. The web app maps them to messages. */
export const ErrorCode = {
  ValidationFailed: 'VALIDATION_FAILED',
  Unauthenticated: 'UNAUTHENTICATED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  InvalidCredentials: 'INVALID_CREDENTIALS',
  AccountLocked: 'ACCOUNT_LOCKED',
  PasswordChangeRequired: 'PASSWORD_CHANGE_REQUIRED',
  PasswordReuse: 'PASSWORD_REUSE',
  RateLimited: 'RATE_LIMITED',
  CsrfRejected: 'CSRF_REJECTED',
  Internal: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    /** Field-level problems for VALIDATION_FAILED. Keys are field paths. */
    fields?: Record<string, string[]>;
  };
}

/** Header every state-changing request must carry (CSRF mitigation for same-origin cookies). */
export const CSRF_HEADER = 'X-Requested-With';
export const CSRF_HEADER_VALUE = 'telesales-web';
