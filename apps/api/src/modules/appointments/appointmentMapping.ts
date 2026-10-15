import type {
  AppointmentDetail,
  AppointmentListItem,
  ChangeRequestDto,
  ChangeRequestStatus,
} from '@telesales/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { dateOnly, iso, userRef, userRefSelect } from '../../http/mappers.js';
import { toFileDto } from '../files/FileService.js';

const OPEN_REQUEST: ChangeRequestStatus[] = ['REQUESTED', 'IN_PROGRESS'];

export const appointmentListInclude = {
  company: { select: { id: true, name: true, clientNo: true } },
  salesRep: userRefSelect,
  bookedBy: userRefSelect,
  changeRequests: {
    where: { status: { in: OPEN_REQUEST } },
    select: { status: true },
    take: 1,
  },
  _count: { select: { meetingResults: true } },
} satisfies Prisma.AppointmentInclude;

export type AppointmentListRow = Prisma.AppointmentGetPayload<{
  include: typeof appointmentListInclude;
}>;

export const appointmentDetailInclude = {
  company: {
    select: {
      id: true,
      name: true,
      clientNo: true,
      office: true,
      department: true,
      phone: true,
      address: true,
      nearestStation: true,
      url: true,
    },
  },
  salesRep: userRefSelect,
  bookedBy: userRefSelect,
  dayBeforeCheckedBy: userRefSelect,
  cancelledBy: userRefSelect,
  sourceFiles: { orderBy: { createdAt: 'asc' }, include: { file: true } },
  rebookings: { select: { id: true } },
  plan: { select: { id: true, attendees: { include: { user: userRefSelect } } } },
  preparations: {
    orderBy: { createdAt: 'asc' },
    include: { author: userRefSelect, attachments: { include: { file: true } } },
  },
  meetingResults: { orderBy: { createdAt: 'asc' }, include: { author: userRefSelect } },
  changes: { orderBy: { createdAt: 'asc' }, include: { changedBy: userRefSelect } },
  changeRequests: {
    orderBy: { createdAt: 'asc' },
    include: { requestedBy: userRefSelect, handler: userRefSelect },
  },
  emails: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      noticeCode: true,
      subject: true,
      status: true,
      sentAt: true,
      createdBy: userRefSelect,
    },
  },
  _count: { select: { meetingResults: true } },
} satisfies Prisma.AppointmentInclude;

export type AppointmentDetailRow = Prisma.AppointmentGetPayload<{
  include: typeof appointmentDetailInclude;
}>;

export function toListItem(row: AppointmentListRow | AppointmentDetailRow): AppointmentListItem {
  const open = row.changeRequests.find((request) => OPEN_REQUEST.includes(request.status));
  return {
    id: row.id,
    company: { id: row.company.id, name: row.company.name, clientNo: row.company.clientNo },
    salesRep: userRef(row.salesRep),
    bookedBy: userRef(row.bookedBy),
    bookedAt: iso(row.bookedAt),
    startsAt: iso(row.startsAt),
    endsAt: iso(row.endsAt),
    format: row.format,
    status: row.status,
    source: row.source,
    customerType: row.customerType,
    listName: row.listName,
    isNewAppointment: row.isNewAppointment,
    salesConfirmedAt: iso(row.salesConfirmedAt),
    dayBeforeResult: row.dayBeforeResult,
    hasMeetingUrl: Boolean(row.meetingUrl),
    hasResult: row._count.meetingResults > 0,
    openChangeRequest: open?.status ?? null,
  };
}

export function toChangeRequestDto(
  row: Prisma.ChangeRequestGetPayload<{
    include: { requestedBy: typeof userRefSelect; handler: typeof userRefSelect };
  }>,
): ChangeRequestDto {
  return {
    id: row.id,
    appointmentId: row.appointmentId,
    requestedBy: userRef(row.requestedBy),
    handler: userRef(row.handler),
    message: row.message,
    status: row.status,
    createdAt: iso(row.createdAt),
    takenAt: iso(row.takenAt),
    doneAt: iso(row.doneAt),
  };
}

export function attendeeIdsOf(row: AppointmentDetailRow): string[] {
  return row.plan?.attendees.map((attendee) => attendee.userId) ?? [];
}

export function toDetail(
  row: AppointmentDetailRow,
  abilities: AppointmentDetail['abilities'],
): AppointmentDetail {
  return {
    ...toListItem(row),
    version: row.version,
    company: row.company,
    visitAddress: row.visitAddress,
    contactName: row.contactName,
    contactDepartment: row.contactDepartment,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    handoverNotes: row.handoverNotes,
    meetingUrl: row.meetingUrl,
    dayBeforeCheckedBy: userRef(row.dayBeforeCheckedBy),
    dayBeforeCheckedAt: iso(row.dayBeforeCheckedAt),
    cancelledAt: iso(row.cancelledAt),
    cancelledBy: userRef(row.cancelledBy),
    sourceCallRecordId: row.sourceCallRecordId,
    originalAppointmentId: row.originalAppointmentId,
    rebookingIds: row.rebookings.map((rebooking) => rebooking.id),
    sourceFiles: row.sourceFiles.map((source) => ({
      file: toFileDto(source.file),
      sourceType: source.sourceType,
      rowNumber: source.rowNumber,
    })),
    attendees: row.plan?.attendees.map((attendee) => userRef(attendee.user)) ?? [],
    preparations: row.preparations.map((preparation) => ({
      id: preparation.id,
      author: userRef(preparation.author),
      note: preparation.note,
      files: preparation.attachments.map((attachment) => toFileDto(attachment.file)),
      createdAt: iso(preparation.createdAt),
    })),
    results: row.meetingResults.map((result) => ({
      id: result.id,
      author: userRef(result.author),
      visitedOn: dateOnly(result.visitedOn),
      attendee: result.attendee,
      discussion: result.discussion,
      response: result.response,
      dealStatus: result.dealStatus,
      nextAction: result.nextAction,
      nextActionDate: dateOnly(result.nextActionDate),
      nextActionDoneAt: iso(result.nextActionDoneAt),
      createdAt: iso(result.createdAt),
    })),
    changes: row.changes.map((change) => ({
      id: change.id,
      changedBy: userRef(change.changedBy),
      reason: change.reason,
      before: change.before as AppointmentDetail['changes'][number]['before'],
      after: change.after as AppointmentDetail['changes'][number]['after'],
      createdAt: iso(change.createdAt),
    })),
    changeRequests: row.changeRequests.map(toChangeRequestDto),
    emails: row.emails.map((email) => ({
      id: email.id,
      noticeCode: email.noticeCode,
      subject: email.subject,
      status: email.status,
      sentAt: iso(email.sentAt),
      createdBy: userRef(email.createdBy),
    })),
    abilities,
    createdAt: iso(row.createdAt),
  };
}
