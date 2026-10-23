import { z } from 'zod';
import { dateString, type UserRef } from './common.js';

export interface NotificationDto {
  id: string;
  noticeCode: string;
  title: string;
  /** Extra line under the title (e.g. the comment text), when the notice has one. */
  body: string | null;
  linkPath: string | null;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationDto[];
  unreadCount: number;
  /** Pass as `before` to load the next page; null when there is no more. */
  nextCursor: string | null;
  /** Unread count per notice code in the inbox, for the filter chips. */
  unreadByCode: Record<string, number>;
}

export const notificationQuerySchema = z.object({
  box: z.enum(['inbox', 'unread', 'archived']).default('inbox'),
  q: z.string().trim().max(100).optional(),
  codes: z
    .string()
    .max(200)
    .optional()
    .transform((value) => (value ? value.split(',').filter(Boolean) : [])),
  before: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type NotificationQuery = z.infer<typeof notificationQuerySchema>;

export const dashboardQuerySchema = z.object({
  from: dateString,
  to: dateString,
  telemarketerId: z.uuid().optional(),
  salesRepId: z.uuid().optional(),
  listName: z.string().trim().max(200).optional(),
  /** 業種 and 地域 (prefecture) of the company (Q-12, 10/20). */
  industry: z.string().trim().max(100).optional(),
  prefecture: z.string().trim().max(10).optional(),
});
export type DashboardQuery = z.input<typeof dashboardQuerySchema>;

export interface DashboardResponse {
  from: string;
  to: string;
  calls: number;
  appointments: number;
  /** appointments ÷ calls made in ① (new lists); null when there were no calls. */
  appointmentRate: number | null;
  meetings: {
    scheduled: number;
    completed: number;
    cancelled: number;
    awaitingResult: number;
  };
  byTelemarketer: { user: UserRef; calls: number; appointments: number }[];
  bySalesRep: { user: UserRef; appointments: number; completed: number }[];
  byList: { listName: string; calls: number; appointments: number }[];
  byGrade: { grade: string; count: number }[];
}

/** Lightweight list for pickers (sales reps, telemarketers, everyone). */
export interface PersonDto extends UserRef {
  roles: string[];
}

export interface HomeSummaryResponse {
  todayPlans: number;
  unconfirmedAppointments: number;
  missingResults: number;
  openChangeRequests: number;
  dayBeforePending: number;
  dayBeforeDate: string;
  newCallLists: number;
  duplicatesToResolve: number;
  /** Today's confirmed allocation for this person (telemarketing). */
  myCalls: number;
  myDayBefore: number;
  /** Today's allocation is still a draft (leads). */
  allocationToConfirm: boolean;
  /** Own open next actions due today or earlier (sales). */
  nextActionsDue: number;
}
