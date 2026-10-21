import { z } from 'zod';
import type {
  AppointmentStatus,
  HolidayKind,
  MeetingFormat,
  PlanStatus,
  TimeOffKind,
} from '../enums.js';
import { dateString, instantString, optionalText, requiredText, type UserRef } from './common.js';

export const scheduleQuerySchema = z.object({
  from: dateString,
  to: dateString,
  /** Comma-separated user ids; empty = all sales reps. */
  userIds: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',').filter(Boolean) : []))
    .pipe(z.array(z.uuid()).max(50)),
});
export type ScheduleQuery = z.input<typeof scheduleQuerySchema>;

export const repeatSchema = z.object({
  /** Repeat weekly on the same weekday, this many times in total (including the first). */
  weeklyCount: z.number().int().min(2).max(52),
});

export const planRequestSchema = z.object({
  ownerId: z.uuid(),
  type: requiredText(48),
  title: requiredText(200),
  startsAt: instantString,
  endsAt: instantString,
  allDay: z.boolean().default(false),
  status: z.enum(['FIXED', 'TENTATIVE']).default('FIXED'),
  holidayWork: z.boolean().default(false),
  note: optionalText(2000),
  attendeeIds: z.array(z.uuid()).max(20).default([]),
  /** Tentative candidate dates share a group so one can be confirmed later. */
  candidateGroupId: z.uuid().nullish(),
  repeat: repeatSchema.nullish(),
});
export type PlanRequest = z.input<typeof planRequestSchema>;

export const timeOffRequestSchema = z.object({
  userId: z.uuid(),
  kind: z.enum(['DAY_OFF', 'LATE_START', 'EARLY_LEAVE', 'PARTIAL', 'TELEMA_STOP']),
  startsAt: instantString,
  endsAt: instantString,
  allDay: z.boolean().default(false),
  note: optionalText(200),
  /** Repeat the same time band every day up to this date (e.g. テレマアポ停止 for a week). */
  repeatUntil: dateString.nullish(),
});
export type TimeOffRequest = z.input<typeof timeOffRequestSchema>;

export const slotLockRequestSchema = z.object({
  salesRepId: z.uuid(),
  startsAt: instantString,
  endsAt: instantString,
});
export type SlotLockRequest = z.infer<typeof slotLockRequestSchema>;

export interface PlanDto {
  id: string;
  owner: UserRef;
  createdBy: UserRef;
  type: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  status: PlanStatus;
  holidayWork: boolean;
  note: string | null;
  candidateGroupId: string | null;
  seriesId: string | null;
  attendees: UserRef[];
  appointment: {
    id: string;
    companyName: string;
    format: MeetingFormat;
    status: AppointmentStatus;
    isTelema: boolean;
  } | null;
  canEdit: boolean;
}

export interface TimeOffDto {
  id: string;
  user: UserRef;
  enteredBy: UserRef;
  kind: TimeOffKind;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  note: string | null;
}

export interface CalendarDayDto {
  date: string;
  name: string;
  kind: HolidayKind;
}

export interface SlotLockDto {
  id: string;
  salesRep: UserRef;
  lockedBy: UserRef;
  startsAt: string;
  endsAt: string;
  expiresAt: string;
  isMine: boolean;
}

export interface ScheduleResponse {
  people: (UserRef & { isSales: boolean })[];
  plans: PlanDto[];
  timeOff: TimeOffDto[];
  holidays: CalendarDayDto[];
  locks: SlotLockDto[];
  /** Minutes to keep free before and after a plan (spec §7, value being confirmed). */
  travelBufferMinutes: number;
}

/** Result of checking one slot before booking. */
export interface SlotCheckResult {
  ok: boolean;
  problems: SlotProblem[];
  warnings: string[];
}

export type SlotProblem =
  | { kind: 'NOT_BUSINESS_DAY'; date: string; name: string | null }
  | { kind: 'TIME_OFF'; startsAt: string; endsAt: string }
  /** テレマアポ停止: the rep keeps this time for their own work (営業枠). */
  | { kind: 'SALES_BLOCK'; startsAt: string; endsAt: string }
  | { kind: 'OVERLAP'; title: string; startsAt: string; endsAt: string }
  | { kind: 'LOCKED'; by: string }
  | { kind: 'INVALID_TIME' };

export const confirmCandidateRequestSchema = z.object({
  planId: z.uuid(),
});
