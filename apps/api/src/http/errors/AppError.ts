import { ErrorCode } from '@telesales/shared';

/** Base class for errors that map to a known HTTP response. */
export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: ErrorCode;

  constructor(message?: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  readonly status = 400;
  readonly code = ErrorCode.ValidationFailed;

  constructor(readonly fields: Record<string, string[]>) {
    super('Request validation failed');
  }
}

export class UnauthenticatedError extends AppError {
  readonly status = 401;
  readonly code = ErrorCode.Unauthenticated;
}

export class InvalidCredentialsError extends AppError {
  readonly status = 401;
  readonly code = ErrorCode.InvalidCredentials;
}

export class AccountLockedError extends AppError {
  readonly status = 423;
  readonly code = ErrorCode.AccountLocked;
}

export class ForbiddenError extends AppError {
  readonly status = 403;
  readonly code = ErrorCode.Forbidden;
}

export class PasswordChangeRequiredError extends AppError {
  readonly status = 403;
  readonly code = ErrorCode.PasswordChangeRequired;
}

export class PasswordReuseError extends AppError {
  readonly status = 400;
  readonly code = ErrorCode.PasswordReuse;
}

export class CsrfRejectedError extends AppError {
  readonly status = 403;
  readonly code = ErrorCode.CsrfRejected;
}

export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code = ErrorCode.NotFound;
}
