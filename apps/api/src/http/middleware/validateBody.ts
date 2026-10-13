import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from '../errors/AppError.js';

/** Parses req.body with the given schema and replaces it with the typed result. */
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_';
        (fields[key] ??= []).push(issue.code);
      }
      next(new ValidationError(fields));
      return;
    }
    req.body = result.data;
    next();
  };
}
