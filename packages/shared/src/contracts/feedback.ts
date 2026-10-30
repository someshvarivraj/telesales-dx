import { z } from 'zod';
import type { UserRef } from './common.js';

/** ご意見・不具合の報告: what kind of report it is. */
export const FEEDBACK_TYPES = ['BUG', 'REQUEST', 'FIX', 'OTHER'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = {
  BUG: '不具合',
  REQUEST: '要望・提案',
  FIX: '修正依頼',
  OTHER: 'その他',
};

/** Where a report is in its handling (管理 → ご意見). */
export const FEEDBACK_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_DECISION', 'RESOLVED'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  OPEN: '未対応',
  IN_PROGRESS: '対応中',
  WAITING_DECISION: '判断待ち',
  RESOLVED: '対応済み',
};

export const createFeedbackRequestSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  body: z.string().trim().min(1).max(4000),
  /** The screen it was sent from; the server only keeps in-app paths. */
  screenPath: z.string().max(500),
  screenName: z.string().trim().max(100).optional(),
});
export type CreateFeedbackRequest = z.infer<typeof createFeedbackRequestSchema>;

export const updateFeedbackRequestSchema = z
  .object({
    status: z.enum(FEEDBACK_STATUSES),
    note: z.string().trim().max(2000).nullish(),
    /** Required when resolving: mailed to everyone on the report. */
    resolution: z.string().trim().max(4000).nullish(),
  })
  .refine((value) => value.status !== 'RESOLVED' || Boolean(value.resolution), {
    path: ['resolution'],
    message: 'required',
  });
export type UpdateFeedbackRequest = z.infer<typeof updateFeedbackRequestSchema>;

export const feedbackQuerySchema = z.object({
  status: z.enum(FEEDBACK_STATUSES).optional(),
});

export interface FeedbackDto {
  id: string;
  number: number;
  type: FeedbackType;
  body: string;
  screenPath: string;
  screenName: string;
  status: FeedbackStatus;
  note: string | null;
  resolution: string | null;
  reporter: UserRef;
  handledBy: UserRef | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface FeedbackListResponse {
  items: FeedbackDto[];
  counts: Record<FeedbackStatus, number>;
}
