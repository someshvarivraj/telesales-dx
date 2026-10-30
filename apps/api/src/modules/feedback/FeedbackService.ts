import {
  type CreateFeedbackRequest,
  FEEDBACK_FILE_TYPES,
  FEEDBACK_MAX_FILE_BYTES,
  FEEDBACK_MAX_FILES,
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPE_LABEL,
  type FeedbackDto,
  type FeedbackListResponse,
  type FeedbackStatus,
  type FeedbackType,
  formatJstDateTime,
  NoticeCode,
  Permission,
  type UpdateFeedbackRequest,
} from '@telesales/shared';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import {
  FileTooLargeError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../http/errors/AppError.js';
import { iso, userRef, userRefSelect } from '../../http/mappers.js';
import {
  type FileService,
  type StoredFileRecord,
  toFileDto,
  type UploadedFile,
} from '../files/FileService.js';
import type { NotificationService } from '../notifications/NotificationService.js';

const include = {
  reporter: userRefSelect,
  handledBy: userRefSelect,
  attachments: { include: { file: true }, orderBy: { createdAt: 'asc' } },
} as const;
const ALLOWED_TYPES = new Set<string>(FEEDBACK_FILE_TYPES);
/** Attachments ride along in the mail up to this total; bigger ones stay in the app. */
const MAIL_ATTACH_BYTES = 10 * 1024 * 1024;
/** Only in-app paths are kept (never a full URL someone pasted). */
const IN_APP_PATH = /^\/[\w\-./?=&%]*$/;

/**
 * ご意見・不具合の報告: anyone can send one from any screen; it is mailed to the N20
 * recipients (admins by default) and the sender. Admins track it on 管理 → ご意見, and
 * when it is resolved, what was done is mailed to the same people.
 */
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly notifications: NotificationService,
    private readonly audit: AuditLogger,
    private readonly files: FileService,
    private readonly appBaseUrl: string,
  ) {}

  async create(
    actor: Actor,
    input: CreateFeedbackRequest,
    uploads: UploadedFile[] = [],
  ): Promise<FeedbackDto> {
    if (uploads.length > FEEDBACK_MAX_FILES) {
      throw new ValidationError({ files: ['too_many'] });
    }
    for (const upload of uploads) {
      if (upload.size > FEEDBACK_MAX_FILE_BYTES) {
        throw new FileTooLargeError();
      }
      if (!ALLOWED_TYPES.has(upload.mimetype)) {
        throw new ValidationError({ files: ['unsupported_type'] });
      }
    }
    const stored: StoredFileRecord[] = [];
    for (const upload of uploads) {
      stored.push(await this.files.store(upload, actor.id));
    }
    const screenPath = IN_APP_PATH.test(input.screenPath) ? input.screenPath : '/';
    const row = await this.prisma.feedback.create({
      data: {
        reporterId: actor.id,
        type: input.type,
        body: input.body,
        screenPath,
        screenName: input.screenName || screenPath,
        attachments: { create: stored.map((file) => ({ fileId: file.id })) },
      },
      include,
    });
    const type = FEEDBACK_TYPE_LABEL[row.type as FeedbackType];
    const mailable = uploads.reduce((sum, upload) => sum + upload.size, 0) <= MAIL_ATTACH_BYTES;
    await this.notifications.notify({
      code: NoticeCode.Feedback,
      title: `${row.reporter.name}さんから${type}の報告（No.${row.number}）`,
      body: row.body.slice(0, 200),
      linkPath: `/admin/feedback?id=${row.id}`,
      actorId: actor.id,
      context: { REPORTER: [actor.id] },
      email: {
        subject: `架電システム：${type}`,
        text: [
          `${row.reporter.name}さんから「${type}」の報告がありました。`,
          '',
          row.body,
          '',
          '――――――――――',
          `No.: ${row.number}`,
          `種類: ${type}`,
          `送った人: ${row.reporter.name}`,
          `日時: ${formatJstDateTime(row.createdAt)}`,
          `画面: ${row.screenName}（${this.appBaseUrl}${row.screenPath}）`,
          ...(stored.length > 0
            ? [
                `添付: ${stored.map((file) => file.originalName).join('、')}${
                  mailable ? '' : '（サイズが大きいため、アプリでご確認ください）'
                }`,
              ]
            : []),
          '',
          `対応状況: ${this.appBaseUrl}/admin/feedback?id=${row.id}`,
        ].join('\n'),
        dedupeKey: `feedback:${row.id}`,
        attachments: mailable
          ? stored.map((file, i) => ({
              fileId: file.id,
              filename: file.originalName,
              contentType: file.contentType,
              content: uploads[i]?.buffer ?? Buffer.alloc(0),
            }))
          : [],
      },
    });
    return toDto(row);
  }

  async list(status?: FeedbackStatus): Promise<FeedbackListResponse> {
    const [rows, grouped] = await Promise.all([
      this.prisma.feedback.findMany({
        where: status ? { status } : {},
        orderBy: { createdAt: 'desc' },
        include,
        take: 500,
      }),
      this.prisma.feedback.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const counts = Object.fromEntries(FEEDBACK_STATUSES.map((s) => [s, 0])) as Record<
      FeedbackStatus,
      number
    >;
    for (const group of grouped) {
      counts[group.status as FeedbackStatus] = group._count._all;
    }
    return { items: rows.map(toDto), counts };
  }

  /** An attachment, for an admin or the person who sent it. */
  async file(
    actor: Actor,
    id: string,
    fileId: string,
  ): Promise<Awaited<ReturnType<FileService['read']>>> {
    const link = await this.prisma.feedbackAttachment.findFirst({
      where: { feedbackId: id, fileId },
      include: { feedback: { select: { reporterId: true } } },
    });
    if (!link) {
      throw new NotFoundError();
    }
    if (link.feedback.reporterId !== actor.id && !actor.can(Permission.Administer)) {
      throw new ForbiddenError();
    }
    return this.files.read(fileId);
  }

  /** Mine: what I sent and where it stands. */
  async mine(userId: string): Promise<FeedbackDto[]> {
    const rows = await this.prisma.feedback.findMany({
      where: { reporterId: userId },
      orderBy: { createdAt: 'desc' },
      include,
      take: 100,
    });
    return rows.map(toDto);
  }

  async update(actor: Actor, id: string, input: UpdateFeedbackRequest): Promise<FeedbackDto> {
    const before = await this.prisma.feedback.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundError();
    }
    const resolving = input.status === 'RESOLVED' && before.status !== 'RESOLVED';
    const row = await this.prisma.feedback.update({
      where: { id },
      data: {
        status: input.status,
        note: input.note === undefined ? before.note : input.note || null,
        resolution: input.resolution === undefined ? before.resolution : input.resolution || null,
        handledById: actor.id,
        resolvedAt: input.status === 'RESOLVED' ? (before.resolvedAt ?? new Date()) : null,
      },
      include,
    });
    await this.audit.record({
      action: AuditAction.FeedbackUpdated,
      actorUserId: actor.id,
      targetType: 'feedback',
      targetId: id,
      before: { status: before.status },
      after: { status: row.status },
    });

    const type = FEEDBACK_TYPE_LABEL[row.type as FeedbackType];
    if (resolving) {
      await this.notifications.notify({
        code: NoticeCode.Feedback,
        title: `No.${row.number}（${type}）に対応しました`,
        body: (row.resolution ?? '').slice(0, 200),
        linkPath: `/admin/feedback?id=${row.id}`,
        actorId: actor.id,
        context: { REPORTER: [row.reporterId] },
        email: {
          subject: `架電システム：${type}（対応済み）`,
          text: [
            `No.${row.number}「${type}」の報告に対応しました。`,
            '',
            '【対応内容】',
            row.resolution ?? '',
            '',
            '【いただいた内容】',
            row.body,
            '',
            '――――――――――',
            `送った人: ${row.reporter.name}`,
            `日時: ${formatJstDateTime(row.createdAt)}`,
            `画面: ${row.screenName}（${this.appBaseUrl}${row.screenPath}）`,
          ].join('\n'),
          dedupeKey: `feedback:${row.id}:resolved:${row.resolvedAt?.getTime() ?? 0}`,
        },
      });
    } else if (row.status !== before.status) {
      // The sender sees on screen where their report stands.
      await this.notifications.notifyUsers([row.reporterId], {
        code: NoticeCode.Feedback,
        title: `No.${row.number}（${type}）：${FEEDBACK_STATUS_LABEL[row.status as FeedbackStatus]}`,
        actorId: actor.id,
      });
    }
    return toDto(row);
  }
}

interface Row {
  id: string;
  number: number;
  type: string;
  body: string;
  screenPath: string;
  screenName: string;
  status: string;
  note: string | null;
  resolution: string | null;
  reporter: { id: string; name: string };
  handledBy: { id: string; name: string } | null;
  attachments: { file: StoredFileRecord }[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

function toDto(row: Row): FeedbackDto {
  return {
    id: row.id,
    number: row.number,
    type: row.type as FeedbackType,
    body: row.body,
    screenPath: row.screenPath,
    screenName: row.screenName,
    status: row.status as FeedbackStatus,
    note: row.note,
    resolution: row.resolution,
    reporter: userRef(row.reporter),
    handledBy: userRef(row.handledBy),
    files: row.attachments.map((attachment) => toFileDto(attachment.file)),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    resolvedAt: iso(row.resolvedAt),
  };
}
