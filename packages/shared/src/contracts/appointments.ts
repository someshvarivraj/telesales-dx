import { z } from 'zod';
import type {
  AppointmentSource,
  AppointmentStatus,
  ChangeReason,
  ChangeRequestStatus,
  DayBeforeResult,
  EmailStatus,
  MeetingFormat,
} from '../enums.js';
import {
  dateString,
  type FileDto,
  instantString,
  optionalText,
  requiredText,
  type UserRef,
} from './common.js';
import { companyFieldsSchema } from './companies.js';

const appointmentContactFields = {
  visitAddress: optionalText(300),
  contactName: optionalText(100),
  contactDepartment: optionalText(100),
  contactPhone: optionalText(64),
  contactEmail: z
    .string()
    .trim()
    .max(254)
    .nullish()
    .transform((value) => (value ? value : null))
    .pipe(z.email().nullable()),
  handoverNotes: optionalText(10_000),
  customerType: optionalText(48),
  listName: optionalText(200),
  isNewAppointment: z.boolean().default(false),
};

export const createAppointmentRequestSchema = z
  .object({
    source: z.enum(['CALL_STATUS', 'FILE', 'MANUAL', 'SALES_BOOKED']),
    /** Link to a company already in the register… */
    companyId: z.uuid().nullish(),
    /** …or company data to register / update (existing lists, sales-booked). */
    company: companyFieldsSchema.nullish(),
    sourceCallRecordId: z.uuid().nullish(),
    /** CSV / handover PDF the data was read from (stored with the appointment). */
    sourceFileIds: z.array(z.uuid()).max(2).default([]),
    /** Which CSV row was used when the export had several rows. */
    sourceRowKey: z.string().max(20).nullish(),
    salesRepId: z.uuid(),
    startsAt: instantString,
    endsAt: instantString,
    format: z.enum(['VISIT', 'ONLINE']),
    /** Booker as read from the file; defaults to the signed-in user. */
    bookedById: z.uuid().nullish(),
    bookedOn: dateString.nullish(),
    /** Re-booking after a cancellation links to the original. */
    originalAppointmentId: z.uuid().nullish(),
    ...appointmentContactFields,
  })
  .refine((value) => value.companyId || value.company, { path: ['company'], message: 'required' });
export type CreateAppointmentRequest = z.input<typeof createAppointmentRequestSchema>;
export type CreateAppointmentCommand = z.output<typeof createAppointmentRequestSchema>;

export const updateAppointmentDetailsRequestSchema = z.object({
  expectedVersion: z.number().int().min(1),
  format: z.enum(['VISIT', 'ONLINE']),
  ...appointmentContactFields,
});
export type UpdateAppointmentDetailsRequest = z.input<typeof updateAppointmentDetailsRequestSchema>;

export const rescheduleRequestSchema = z.object({
  expectedVersion: z.number().int().min(1),
  salesRepId: z.uuid(),
  startsAt: instantString,
  endsAt: instantString,
  reason: z.enum(['OUR_SIDE', 'CUSTOMER_SIDE']),
  changeRequestId: z.uuid().nullish(),
});
export type RescheduleRequest = z.infer<typeof rescheduleRequestSchema>;

export const cancelAppointmentRequestSchema = z.object({
  expectedVersion: z.number().int().min(1),
  note: optionalText(500),
});
export type CancelAppointmentRequest = z.infer<typeof cancelAppointmentRequestSchema>;

export const meetingUrlRequestSchema = z.object({
  meetingUrl: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((value) => (value ? value : null))
    .pipe(z.url({ protocol: /^https?$/ }).nullable()),
});
export type MeetingUrlRequest = z.input<typeof meetingUrlRequestSchema>;

export const meetingResultRequestSchema = z.object({
  visitedOn: dateString,
  attendee: optionalText(100),
  discussion: requiredText(10_000),
  response: optionalText(48),
  dealStatus: optionalText(48),
  nextAction: optionalText(2000),
  nextActionDate: dateString.nullish(),
});
export type MeetingResultRequest = z.input<typeof meetingResultRequestSchema>;

export const changeRequestRequestSchema = z.object({
  message: requiredText(2000),
});
export type ChangeRequestRequest = z.infer<typeof changeRequestRequestSchema>;

export const dayBeforeCheckRequestSchema = z.object({
  result: z.enum(['CONFIRMED', 'NOT_REACHED', 'CHANGED']),
});
export type DayBeforeCheckRequest = z.infer<typeof dayBeforeCheckRequestSchema>;

export const appointmentListQuerySchema = z.object({
  /** Meeting date range (JST). */
  from: dateString.optional(),
  to: dateString.optional(),
  /** Booking date range (JST) — the report uses this one. */
  bookedFrom: dateString.optional(),
  bookedTo: dateString.optional(),
  salesRepId: z.uuid().optional(),
  bookedById: z.uuid().optional(),
  companyId: z.uuid().optional(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).optional(),
  listName: z.string().trim().max(200).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type AppointmentListQuery = Omit<
  z.input<typeof appointmentListQuerySchema>,
  'page' | 'pageSize'
> & {
  page?: number;
  pageSize?: number;
};

export const reportQuerySchema = z.object({
  bookedFrom: dateString,
  bookedTo: dateString,
});

export interface AppointmentCompanyRef {
  id: string;
  name: string;
  clientNo: string | null;
}

export interface AppointmentListItem {
  id: string;
  company: AppointmentCompanyRef;
  salesRep: UserRef;
  bookedBy: UserRef;
  bookedAt: string;
  startsAt: string;
  endsAt: string;
  format: MeetingFormat;
  status: AppointmentStatus;
  source: AppointmentSource;
  customerType: string | null;
  listName: string | null;
  isNewAppointment: boolean;
  salesConfirmedAt: string | null;
  dayBeforeResult: DayBeforeResult | null;
  hasMeetingUrl: boolean;
  hasResult: boolean;
  openChangeRequest: ChangeRequestStatus | null;
}

export interface PreparationDto {
  id: string;
  author: UserRef;
  note: string | null;
  files: FileDto[];
  createdAt: string;
}

export interface MeetingResultDto {
  id: string;
  author: UserRef;
  visitedOn: string;
  attendee: string | null;
  discussion: string;
  response: string | null;
  dealStatus: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  createdAt: string;
}

export interface AppointmentChangeDto {
  id: string;
  changedBy: UserRef;
  reason: ChangeReason | null;
  before: { startsAt?: string; endsAt?: string; salesRep?: UserRef; [key: string]: unknown };
  after: { startsAt?: string; endsAt?: string; salesRep?: UserRef; [key: string]: unknown };
  createdAt: string;
}

export interface ChangeRequestDto {
  id: string;
  appointmentId: string;
  requestedBy: UserRef;
  handler: UserRef | null;
  message: string;
  status: ChangeRequestStatus;
  createdAt: string;
  takenAt: string | null;
  doneAt: string | null;
}

export interface ChangeRequestListItem extends ChangeRequestDto {
  appointment: Pick<
    AppointmentListItem,
    'id' | 'company' | 'salesRep' | 'startsAt' | 'endsAt' | 'bookedBy'
  >;
}

export interface EmailSummaryDto {
  id: string;
  noticeCode: string;
  subject: string;
  status: EmailStatus;
  sentAt: string | null;
  createdBy: UserRef | null;
}

/** What the signed-in user may do on this appointment (computed by the server). */
export interface AppointmentAbilities {
  confirm: boolean;
  editMeetingUrl: boolean;
  addPreparation: boolean;
  addResult: boolean;
  requestChange: boolean;
  reschedule: boolean;
  cancel: boolean;
  rebook: boolean;
  editDetails: boolean;
  dayBeforeCheck: boolean;
  sendBookingMail: boolean;
  comment: boolean;
}

export interface AppointmentDetail extends AppointmentListItem {
  version: number;
  company: AppointmentCompanyRef & {
    office: string | null;
    department: string | null;
    phone: string | null;
    address: string | null;
    nearestStation: string | null;
    url: string | null;
  };
  visitAddress: string | null;
  contactName: string | null;
  contactDepartment: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  handoverNotes: string | null;
  meetingUrl: string | null;
  dayBeforeCheckedBy: UserRef | null;
  dayBeforeCheckedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: UserRef | null;
  sourceCallRecordId: string | null;
  originalAppointmentId: string | null;
  rebookingIds: string[];
  sourceFile: FileDto | null;
  attendees: UserRef[];
  preparations: PreparationDto[];
  results: MeetingResultDto[];
  changes: AppointmentChangeDto[];
  changeRequests: ChangeRequestDto[];
  emails: EmailSummaryDto[];
  abilities: AppointmentAbilities;
  createdAt: string;
}

/** Fields read from the telemarketing CSV / handover PDF, shown for checking before saving. */
export interface AppointmentFilePrefill {
  fileIds: string[];
  /** Send back with the booking so the same file and row are never registered twice. */
  sourceRowKey: string | null;
  alreadyImportedAppointmentId: string | null;
  company: {
    name: string | null;
    office: string | null;
    department: string | null;
    phone: string | null;
    address: string | null;
    prefecture: string | null;
    city: string | null;
    nearestStation: string | null;
    industry: string | null;
    clientNo: string | null;
    telemaIdNo: string | null;
    listingStatus: string | null;
  };
  matchedCompanyId: string | null;
  listName: string | null;
  bookedBy: UserRef | null;
  bookedByName: string | null;
  bookedOn: string | null;
  salesRep: UserRef | null;
  salesRepName: string | null;
  startsAt: string | null;
  contactName: string | null;
  contactPhone: string | null;
  handoverNotes: string | null;
  suggestedFormat: MeetingFormat | null;
  /** Several CSV rows: the telemarketer picks one. */
  csvRows: { index: number; name: string; listName: string | null; calledOn: string | null }[];
  warnings: string[];
}

export interface EmailDraftDto {
  id: string;
  noticeCode: string;
  appointmentId: string | null;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  status: EmailStatus;
  sentAt: string | null;
}

export const updateEmailDraftRequestSchema = z.object({
  to: z.array(z.email()).min(1).max(50),
  cc: z.array(z.email()).max(100).default([]),
  subject: requiredText(300),
  body: requiredText(20_000),
});
export type UpdateEmailDraftRequest = z.input<typeof updateEmailDraftRequestSchema>;

export const createCommentRequestSchema = z
  .object({
    appointmentId: z.uuid().nullish(),
    callRecordId: z.uuid().nullish(),
    parentId: z.uuid().nullish(),
    body: requiredText(4000),
  })
  .refine((value) => Boolean(value.appointmentId) !== Boolean(value.callRecordId), {
    path: ['appointmentId'],
    message: 'exactly_one_target',
  });
export type CreateCommentRequest = z.input<typeof createCommentRequestSchema>;

export interface CommentDto {
  id: string;
  parentId: string | null;
  author: UserRef;
  body: string;
  createdAt: string;
  replies: CommentDto[];
}
