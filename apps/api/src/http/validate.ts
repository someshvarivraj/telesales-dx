import type { Request } from 'express';
import type { ZodType } from 'zod';
import { z } from 'zod';
import { ValidationError } from './errors/AppError.js';

function toValidationError(issues: z.core.$ZodIssue[]): ValidationError {
  const fields: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || '_';
    (fields[key] ??= []).push(issue.code);
  }
  return new ValidationError(fields);
}

/** Parses a value with the schema or throws a 400 with field codes. */
export function parseWith<T extends ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw toValidationError(result.error.issues);
  }
  return result.data;
}

export function parseQuery<T extends ZodType>(schema: T, req: Request): z.output<T> {
  return parseWith(schema, req.query);
}

const uuidSchema = z.uuid();

/** A route parameter that must be a UUID. Invalid ids are reported as 404, not 500. */
export function idParam(req: Request, name = 'id'): string {
  const raw: unknown = (req.params as Record<string, unknown>)[name];
  const result = uuidSchema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError({ [name]: ['invalid_format'] });
  }
  return result.data;
}
