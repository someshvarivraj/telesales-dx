import { type ApiErrorBody, ErrorCode } from '@telesales/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from 'pino';
import { AppError, NotFoundError, ValidationError } from '../errors/AppError.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError());
};

/** Converts any thrown error into the shared ApiErrorBody shape. Never leaks internals. */
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    if (error instanceof AppError) {
      const body: ApiErrorBody = { error: { code: error.code } };
      if (error instanceof ValidationError) {
        body.error.fields = error.fields;
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
