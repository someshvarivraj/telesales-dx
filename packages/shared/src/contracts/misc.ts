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
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationDto[];
  unreadCount: number;
}

export const dashboardQuerySchema = z.object({
  from: dateString,
  to: dateString,
  telemarketerId: z.uuid().optional(),
  salesRepId: z.uuid().optional(),
  listName: z.string().trim().max(200).optional(),
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
