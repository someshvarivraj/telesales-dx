import { type ApiErrorBody, ErrorCode } from '@telesales/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from 'pino';
import {
  AppError,
  FileTooLargeError,
  hasDetails,
  NotFoundError,
  ValidationError,
} from '../errors/AppError.js';

/** body-parser errors carry a `type`; they are the client's fault, not ours. */
function fromBodyParser(error: unknown): AppError | null {
  const type = (error as { type?: unknown } | null)?.type;
  if (type === 'entity.parse.failed' || type === 'encoding.unsupported') {
    return new ValidationError({ _: ['invalid_json'] });
  }
  if (type === 'entity.too.large') {
    return new FileTooLargeError();
  }
  return null;
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError());
};

/** Converts any thrown error into the shared ApiErrorBody shape. Never leaks internals. */
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (thrown: unknown, req, res, _next) => {
    const error = fromBodyParser(thrown) ?? thrown;
    if (error instanceof AppError) {
      const body: ApiErrorBody = { error: { code: error.code } };
      if (error instanceof ValidationError) {
        body.error.fields = error.fields;
      }
      if (hasDetails(error) && error.details !== undefined) {
        body.error.details = error.details;
      }
      if (error.status >= 500) {
        logger.error({ err: error, path: req.path }, 'request failed');
      }
      res.status(error.status).json(body);
      return;
    }

    logger.error({ err: error, path: req.path }, 'unhandled error');
    const body: ApiErrorBody = { error: { code: ErrorCode.Internal } };
    res.status(500).json(body);
  };
}
