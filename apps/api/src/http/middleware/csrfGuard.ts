import { CSRF_HEADER, CSRF_HEADER_VALUE } from '@telesales/shared';
import type { RequestHandler } from 'express';
import { CsrfRejectedError } from '../errors/AppError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Requires a custom header on state-changing requests. Browsers cannot send it
 * cross-origin without a CORS preflight, which this API never allows.
 */
export const csrfGuard: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method) || req.get(CSRF_HEADER) === CSRF_HEADER_VALUE) {
    next();
    return;
  }
  next(new CsrfRejectedError());
};
