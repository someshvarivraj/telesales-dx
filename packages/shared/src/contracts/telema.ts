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

/** 本社・支社・工場・その他 (answer 11/10 No.5 ②): what kind of office a company is. */
export const OFFICE_KINDS = ['HEAD', 'BRANCH', 'FACTORY', 'OTHER'] as const;
export type OfficeKind = (typeof OFFICE_KINDS)[number];
export const OFFICE_KIND_LABELS: Record<OfficeKind, string> = {
  HEAD: '本社',
  BRANCH: '支社・支店',
  FACTORY: '工場',
  OTHER: 'その他',
};

/** Read from 事業所名; an empty one is その他. */
export function officeKindOf(office: string | null | undefined): OfficeKind {
  const text = (office ?? '').normalize('NFKC');
  if (/本社|本店/.test(text)) return 'HEAD';
  if (/工場|製作所|製造所/.test(text)) return 'FACTORY';
  if (/支社|支店|営業所|出張所|事業所|オフィス/.test(text)) return 'BRANCH';
  return 'OTHER';
}

/** 検索結果をテレマに割り振る: the companies found go to the chosen people, evenly. */
export const allocationAssignRequestSchema = z.object({
  date: dateString,
  companyIds: z.array(z.uuid()).min(1).max(2000),
  assigneeIds: z.array(z.uuid()).min(1).max(50),
});
export type AllocationAssignRequest = z.input<typeof allocationAssignRequestSchema>;

export interface AllocationAssignResult {
  assigned: number;
  /** 架電対象外 or 重複: not allocated. */
  skipped: number;
  people: { user: UserRef; total: number; byKind: Record<OfficeKind, number> }[];
}

export interface MyAssignmentsResponse {
  date: string;
  /** Assignments are shown only after the lead has confirmed them. */
  confirmed: boolean;
  calls: number;
  dayBefore: number;
}

export const ALLOCATION_KINDS = [AllocationKind.Call, AllocationKind.DayBefore] as const;
export const ALLOCATION_STATUSES = [AllocationStatus.Draft, AllocationStatus.Confirmed] as const;

/**
 * 架電実績 (answer 11/10 No.3): per telemarketer per day, the calls that count (A–D; E is
 * left out), the appointments (A) and the appointment rate A ÷ (A+B+C+D). Every call
 * counts, also a second call to the same company on the same day.
 */
export const CALL_RESULT_GRADES_COUNTED: readonly string[] = ['A', 'B', 'C', 'D'];
export const CALL_RESULTS_MAX_DAYS = 62;

export const callResultsQuerySchema = z
  .object({ from: dateString, to: dateString })
  .refine((query) => query.from <= query.to, { message: 'from_after_to' });
export type CallResultsQuery = z.infer<typeof callResultsQuerySchema>;

export interface CallResultsCell {
  date: string;
  /** Calls graded A–D. */
  calls: number;
  /** Calls graded A. */
  appointments: number;
}

export interface CallResultsRow {
  telemarketer: UserRef;
  days: CallResultsCell[];
  calls: number;
  appointments: number;
}

export interface CallResultsResponse {
  from: string;
  to: string;
  dates: string[];
  rows: CallResultsRow[];
  /** All telemarketers together, per day. */
  totals: CallResultsCell[];
  calls: number;
  appointments: number;
  /** Telemarketers see only their own row; leads and admins see everyone. */
  ownOnly: boolean;
}

/** A ÷ (A+B+C+D), or null when nothing was called. */
export function appointmentRate(appointments: number, calls: number): number | null {
  return calls > 0 ? appointments / calls : null;
}
