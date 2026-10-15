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
  /** Someone else saved first (optimistic concurrency). Reload and try again. */
  VersionConflict: 'VERSION_CONFLICT',
  /** The time slot cannot be booked (holiday, time off, overlap). Details in `details`. */
  SlotUnavailable: 'SLOT_UNAVAILABLE',
  /** Someone else is editing this rep's time slot. */
  SlotLocked: 'SLOT_LOCKED',
  /** This file was already imported. */
  DuplicateFile: 'DUPLICATE_FILE',
  /** The file could not be read. */
  FileUnreadable: 'FILE_UNREADABLE',
  FileTooLarge: 'FILE_TOO_LARGE',
  /** The request conflicts with the current state (e.g. already cancelled, already sent). */
  InvalidState: 'INVALID_STATE',
  Conflict: 'CONFLICT',
  /** The app is in maintenance; only admins can use it. */
  Maintenance: 'MAINTENANCE',
  Internal: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    /** Field-level problems for VALIDATION_FAILED. Keys are field paths. */
    fields?: Record<string, string[]>;
    /** Extra machine-readable context, e.g. the slot problems or who holds a lock. */
    details?: unknown;
  };
}

/** Header every state-changing request must carry (CSRF mitigation for same-origin cookies). */
export const CSRF_HEADER = 'X-Requested-With';
export const CSRF_HEADER_VALUE = 'telesales-web';
