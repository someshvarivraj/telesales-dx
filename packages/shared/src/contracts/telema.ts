import { z } from 'zod';
import { PREFECTURE_NAMES } from '../prefectures.js';
import { isTimeString } from '../time.js';
import { AllocationKind, AllocationStatus, ShiftKind } from '../enums.js';
import { dateString, optionalText, timeString, type UserRef } from './common.js';

// ---------------------------------------------------------------------------
// Telemarketer info (spec §5: job type, allocation target, territory, usual hours)
// ---------------------------------------------------------------------------

export interface TelemarketerDto {
  user: UserRef;
  roles: string[];
  jobType: string | null;
  /** The manager and people with a fixed territory are not allocation targets. */
  isAllocationTarget: boolean;
  /** Prefectures this person always covers, e.g. 京都府・滋賀県・奈良県. */
  territory: string[];
  usualStart: string | null;
  usualEnd: string | null;
  usualBreakMinutes: number;
  /** 0 = Sunday … 6 = Saturday */
  usualWeekdays: number[];
}

const usualHours = {
  usualStart: timeString.nullable(),
  usualEnd: timeString.nullable(),
  usualBreakMinutes: z.number().int().min(0).max(480),
  usualWeekdays: z.array(z.number().int().min(0).max(6)).max(7),
};

function endAfterStart(value: { usualStart: string | null; usualEnd: string | null }): boolean {
  return !value.usualStart || !value.usualEnd || value.usualEnd > value.usualStart;
}

/** Leads and admins: everything. */
export const telemarketerRequestSchema = z
  .object({
    jobType: optionalText(48),
    isAllocationTarget: z.boolean(),
    territory: z
      .array(z.string().refine((value) => PREFECTURE_NAMES.includes(value), 'unknown_prefecture'))
      .max(47),
    ...usualHours,
  })
  .refine(endAfterStart, { path: ['usualEnd'], message: 'end_before_start' });
export type TelemarketerRequest = z.input<typeof telemarketerRequestSchema>;

/** A telemarketer: only their own usual hours. */
export const usualHoursRequestSchema = z
  .object(usualHours)
  .refine(endAfterStart, { path: ['usualEnd'], message: 'end_before_start' });
export type UsualHoursRequest = z.input<typeof usualHoursRequestSchema>;

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

export interface ShiftDto {
  id: string;
  userId: string;
  date: string;
  kind: ShiftKind;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
  /** Scheduled hours minus break. */
  workingMinutes: number;
  note: string | null;
  enteredBy: UserRef | null;
  updatedAt: string;
}

export const shiftMonthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

export interface ShiftMonthResponse {
  month: string;
  days: { date: string; businessDay: boolean; holidayName: string | null }[];
  people: TelemarketerDto[];
  shifts: ShiftDto[];
}

export const shiftRequestSchema = z
  .object({
    userId: z.uuid(),
    date: dateString,
    kind: z.enum([ShiftKind.Work, ShiftKind.Off]),
    startTime: timeString.nullish(),
    endTime: timeString.nullish(),
    breakMinutes: z.number().int().min(0).max(480).default(0),
    note: optionalText(200),
  })
  .refine(
    (value) =>
      value.kind === ShiftKind.Off ||
      (!!value.startTime &&
        !!value.endTime &&
        isTimeString(value.startTime) &&
        value.endTime > value.startTime),
    { path: ['endTime'], message: 'work_needs_times' },
  );
export type ShiftRequest = z.input<typeof shiftRequestSchema>;

export const fillShiftsRequestSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  /** Leave out for "everyone I may edit". */
  userIds: z.array(z.uuid()).max(200).optional(),
});
export type FillShiftsRequest = z.input<typeof fillShiftsRequestSchema>;

export interface FillShiftsResponse {
  created: number;
  /** Days that already had a shift are never overwritten. */
  skipped: number;
}

export interface TodayStaffResponse {
  date: string;
  businessDay: boolean;
  working: {
    user: UserRef;
    startTime: string | null;
    endTime: string | null;
    breakMinutes: number;
    workingMinutes: number;
    isAllocationTarget: boolean;
    note: string | null;
  }[];
  off: { user: UserRef; note: string | null }[];
  /** Telemarketers with no shift entered for the day. */
  missing: UserRef[];
}

// ---------------------------------------------------------------------------
// Auto allocation
// ---------------------------------------------------------------------------

export interface AllocationItemDto {
  id: string;
  kind: AllocationKind;
  assignee: UserRef;
  status: AllocationStatus;
  company: {
    id: string;
    name: string;
    phone: string | null;
    prefecture: string | null;
    city: string | null;
    listName: string | null;
  } | null;
  appointment: {
    id: string;
    companyName: string;
    startsAt: string;
    salesRep: UserRef;
    bookedBy: UserRef;
  } | null;
}

export interface AllocationTargetDto {
  user: UserRef;
  workingMinutes: number;
  /** Own working hours ÷ everyone's, 0–1. */
  share: number;
  calls: number;
  dayBefore: number;
}

export interface AllocationDayResponse {
  date: string;
  businessDay: boolean;
  state: 'NONE' | 'DRAFT' | 'CONFIRMED';
  confirmedAt: string | null;
  confirmedBy: UserRef | null;
  /** Prefectures left out because someone covers them as a fixed territory. */
  fixedTerritory: string[];
  targets: AllocationTargetDto[];
  /** Day-before checks whose booker is working go straight to them. */
  dayBeforeDates: string[];
  items: AllocationItemDto[];
}

export const allocationDateQuerySchema = z.object({ date: dateString });

export const allocationMoveRequestSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(5000),
  assigneeId: z.uuid(),
});
export type AllocationMoveRequest = z.input<typeof allocationMoveRequestSchema>;

export interface MyAssignmentsResponse {
  date: string;
  /** Assignments are shown only after the lead has confirmed them. */
  confirmed: boolean;
  calls: number;
  dayBefore: number;
}

export const ALLOCATION_KINDS = [AllocationKind.Call, AllocationKind.DayBefore] as const;
export const ALLOCATION_STATUSES = [AllocationStatus.Draft, AllocationStatus.Confirmed] as const;
