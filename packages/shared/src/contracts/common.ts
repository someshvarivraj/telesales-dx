import { z } from 'zod';
import { isDateString, isTimeString } from '../time.js';

export const dateString = z.string().refine(isDateString, 'invalid_date');
export const timeString = z.string().refine(isTimeString, 'invalid_time');
export const instantString = z.iso.datetime({ offset: true });
export const uuid = z.uuid();

/** Optional free text: trims, and turns an empty string into null. */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));
}

export function requiredText(max: number) {
  return z.string().trim().min(1).max(max);
}

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserRef {
  id: string;
  name: string;
}

export interface OptionDto {
  id: string;
  category: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface FileDto {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}
