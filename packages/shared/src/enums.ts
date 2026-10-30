/**
 * Domain enums shared by the API and the web app. Values match the database enums.
 */
function valuesOf<T extends Record<string, string>>(object: T): T[keyof T][] {
  return Object.values(object) as T[keyof T][];
}

export const MeetingFormat = { Visit: 'VISIT', Online: 'ONLINE' } as const;
export type MeetingFormat = (typeof MeetingFormat)[keyof typeof MeetingFormat];
export const MEETING_FORMATS = valuesOf(MeetingFormat);

export const AppointmentStatus = {
  Scheduled: 'SCHEDULED',
  Completed: 'COMPLETED',
  Cancelled: 'CANCELLED',
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];
export const APPOINTMENT_STATUSES = valuesOf(AppointmentStatus);

export const AppointmentSource = {
  /** Booked from ① (new lists) */
  CallStatus: 'CALL_STATUS',
  /** Existing list, imported from the CSV / handover PDF */
  File: 'FILE',
  /** Existing list, typed in */
  Manual: 'MANUAL',
  /** Booked by sales themselves */
  SalesBooked: 'SALES_BOOKED',
} as const;
export type AppointmentSource = (typeof AppointmentSource)[keyof typeof AppointmentSource];
export const APPOINTMENT_SOURCES = valuesOf(AppointmentSource);

/** Appointments booked by telemarketing (the ones sales cannot change directly). */
export function isTelemaSource(source: AppointmentSource): boolean {
  return source !== AppointmentSource.SalesBooked;
}

export const DayBeforeResult = {
  Confirmed: 'CONFIRMED',
  NotReached: 'NOT_REACHED',
  Changed: 'CHANGED',
} as const;
export type DayBeforeResult = (typeof DayBeforeResult)[keyof typeof DayBeforeResult];
export const DAY_BEFORE_RESULTS = valuesOf(DayBeforeResult);

export const ChangeReason = { OurSide: 'OUR_SIDE', CustomerSide: 'CUSTOMER_SIDE' } as const;
export type ChangeReason = (typeof ChangeReason)[keyof typeof ChangeReason];
export const CHANGE_REASONS = valuesOf(ChangeReason);

export const ChangeRequestStatus = {
  Requested: 'REQUESTED',
  InProgress: 'IN_PROGRESS',
  Done: 'DONE',
  Withdrawn: 'WITHDRAWN',
} as const;
export type ChangeRequestStatus = (typeof ChangeRequestStatus)[keyof typeof ChangeRequestStatus];

export const PlanStatus = { Fixed: 'FIXED', Tentative: 'TENTATIVE' } as const;
export type PlanStatus = (typeof PlanStatus)[keyof typeof PlanStatus];

export const TimeOffKind = {
  DayOff: 'DAY_OFF',
  LateStart: 'LATE_START',
  EarlyLeave: 'EARLY_LEAVE',
  Partial: 'PARTIAL',
  /** テレマアポ停止 (Q-07): telemarketing sees the time as taken (営業枠). */
  TelemaStop: 'TELEMA_STOP',
} as const;
export type TimeOffKind = (typeof TimeOffKind)[keyof typeof TimeOffKind];
export const TIME_OFF_KINDS = valuesOf(TimeOffKind);

export const CompanyFlag = {
  None: 'NONE',
  Duplicate: 'DUPLICATE',
  NeedsCheck: 'NEEDS_CHECK',
} as const;
export type CompanyFlag = (typeof CompanyFlag)[keyof typeof CompanyFlag];

export const ListImportPurpose = {
  CallRequest: 'CALL_REQUEST',
  RegisterOnly: 'REGISTER_ONLY',
} as const;
export type ListImportPurpose = (typeof ListImportPurpose)[keyof typeof ListImportPurpose];
export const LIST_IMPORT_PURPOSES = valuesOf(ListImportPurpose);

/** How one row of an imported list was handled. */
export const ListImportRowStatus = {
  Imported: 'IMPORTED',
  Duplicate: 'DUPLICATE',
  NeedsCheck: 'NEEDS_CHECK',
  Invalid: 'INVALID',
} as const;
export type ListImportRowStatus = (typeof ListImportRowStatus)[keyof typeof ListImportRowStatus];
export const LIST_IMPORT_ROW_STATUSES = valuesOf(ListImportRowStatus);

/** A telemarketer's day in the monthly shift (spec §7: time off is entered in the shift). */
export const ShiftKind = { Work: 'WORK', Off: 'OFF' } as const;
export type ShiftKind = (typeof ShiftKind)[keyof typeof ShiftKind];
export const SHIFT_KINDS = valuesOf(ShiftKind);

/** Auto allocation (spec §7): call lists and day-before checks are allocated separately. */
export const AllocationKind = { Call: 'CALL', DayBefore: 'DAY_BEFORE' } as const;
export type AllocationKind = (typeof AllocationKind)[keyof typeof AllocationKind];

export const AllocationStatus = { Draft: 'DRAFT', Confirmed: 'CONFIRMED' } as const;
export type AllocationStatus = (typeof AllocationStatus)[keyof typeof AllocationStatus];

/** What kind of file an existing-list appointment was read from. */
export const SourceFileType = {
  ExistingListCsv: 'EXISTING_LIST_CSV',
  HandoverPdf: 'HANDOVER_PDF',
  Other: 'OTHER',
} as const;
export type SourceFileType = (typeof SourceFileType)[keyof typeof SourceFileType];

export const HolidayKind = {
  PublicHoliday: 'PUBLIC_HOLIDAY',
  CompanyHoliday: 'COMPANY_HOLIDAY',
} as const;
export type HolidayKind = (typeof HolidayKind)[keyof typeof HolidayKind];

export const EmailStatus = {
  Draft: 'DRAFT',
  Queued: 'QUEUED',
  Sent: 'SENT',
  Failed: 'FAILED',
} as const;
export type EmailStatus = (typeof EmailStatus)[keyof typeof EmailStatus];

export const RecipientField = { To: 'TO', Cc: 'CC' } as const;
export type RecipientField = (typeof RecipientField)[keyof typeof RecipientField];

export const RecipientKind = {
  Email: 'EMAIL',
  User: 'USER',
  Role: 'ROLE',
  Context: 'CONTEXT',
} as const;
export type RecipientKind = (typeof RecipientKind)[keyof typeof RecipientKind];
export const RECIPIENT_KINDS = valuesOf(RecipientKind);

/** People resolved per event for CONTEXT recipients. */
export const RecipientContext = {
  AssignedRep: 'ASSIGNED_REP',
  AssignedRepBefore: 'ASSIGNED_REP_BEFORE',
  Booker: 'BOOKER',
  Attendees: 'ATTENDEES',
  PlanOwner: 'PLAN_OWNER',
  Assignee: 'ASSIGNEE',
  RecordAuthor: 'RECORD_AUTHOR',
  Thread: 'THREAD',
  Reporter: 'REPORTER',
} as const;
export type RecipientContext = (typeof RecipientContext)[keyof typeof RecipientContext];
export const RECIPIENT_CONTEXTS = valuesOf(RecipientContext);

/** Notice codes (spec §8). */
export const NoticeCode = {
  Booking: 'N1',
  MeetingLinkRequest: 'N2',
  MeetingUrlMissing: 'N3',
  TomorrowAppointments: 'N4',
  Rescheduled: 'N6',
  ChangeRequested: 'N7',
  Cancelled: 'N8',
  AddedAsAttendee: 'N9',
  PlanChangedByOther: 'N10',
  TodayAssignments: 'N11',
  DayBeforeMissing: 'N12',
  ChangeRequestUntaken: 'N13',
  DayBeforeResult: 'N14',
  TentativeExpired: 'N15',
  MeetingResultPosted: 'N16',
  CallListImported: 'N17',
  Commented: 'N18',
  DailyAppointmentList: 'N19',
  Feedback: 'N20',
} as const;
export type NoticeCode = (typeof NoticeCode)[keyof typeof NoticeCode];

/** Option-list categories edited on the admin screen. */
export const OptionCategory = {
  CallGrade: 'call_grade',
  /** Detailed result under a grade; the code starts with the grade ("B-03"). */
  CallResult: 'call_result',
  CustomerType: 'customer_type',
  PlanType: 'plan_type',
  InterestLevel: 'interest_level',
  MeetingResponse: 'meeting_response',
  DealStatus: 'deal_status',
} as const;
export type OptionCategory = (typeof OptionCategory)[keyof typeof OptionCategory];
export const OPTION_CATEGORIES = valuesOf(OptionCategory);

/** The grade a detailed call result belongs to ("C-02" → "C"). */
export function gradeOfResult(code: string): string {
  return code.split('-')[0] ?? '';
}

/** Grade E (回避・リスト重複) is not counted as a call. */
export const UNCOUNTED_GRADE = 'E';

/** 「C架電回避目安」: months before a company put on hold (grade C) is called again. */
export const AVOID_MONTH_CHOICES = [
  { months: 3, label: '3ヶ月' },
  { months: 6, label: '6ヶ月' },
  { months: 12, label: '1年' },
  { months: 18, label: '1年半' },
  { months: 24, label: '2年' },
] as const;

/** Plan types that are kept in sync with an appointment's format. */
export const APPOINTMENT_PLAN_TYPE: Record<MeetingFormat, string> = {
  [MeetingFormat.Visit]: 'VISIT',
  [MeetingFormat.Online]: 'ONLINE',
};

/** Customer type code meaning "current client" (現取) — used by the area table. */
export const CURRENT_CUSTOMER_TYPE = 'CURRENT';
