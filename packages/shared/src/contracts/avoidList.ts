import { z } from 'zod';
import type { UserRef } from './common.js';

/** Where a number on the 回避企業 list came from: the team's Excel, or ticked on the call screen. */
export type AvoidSource = 'LIST' | 'CALL';

/** One phone number never to be called or imported again (Sano 10/28 ⑥⑦, 10/30). */
export interface AvoidPhoneDto {
  id: string;
  phone: string;
  companyName: string | null;
  source: AvoidSource;
  createdBy: UserRef | null;
  createdAt: string;
  /** Companies with this number that were taken out of the call targets. */
  untargetedCount: number;
}

export const avoidListQuerySchema = z.object({
  keyword: z.string().trim().max(100).default(''),
});
export type AvoidListQuery = z.infer<typeof avoidListQuerySchema>;

export interface AvoidListImportResult {
  /** Numbers read from the file. */
  readCount: number;
  addedCount: number;
  /** Already on the list. */
  existingCount: number;
  /** Companies in the register taken out of the call targets. */
  untargetedCount: number;
}
