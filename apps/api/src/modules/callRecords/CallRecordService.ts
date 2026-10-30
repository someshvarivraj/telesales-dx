import {
  addMonthsToDate,
  type CallRecordDto,
  type CreateCallRecordRequest,
  gradeOfResult,
  jstDate,
} from '@telesales/shared';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { AccessPolicy, Actor } from '../../domain/access/AccessPolicy.js';
import type { Clock } from '../../domain/Clock.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../http/errors/AppError.js';
import { dateOnly, iso, toDbDate, userRef, userRefSelect } from '../../http/mappers.js';

const recordInclude = {
  telemarketer: userRefSelect,
  _count: { select: { comments: { where: { deletedAt: null } } } },
} satisfies Prisma.CallRecordInclude;

type RecordRow = Prisma.CallRecordGetPayload<{ include: typeof recordInclude }>;

function auditShape(row: {
  grade: string;
  resultCode: string | null;
  resultDetail: string | null;
  contactName: string | null;
  interestLevel: string | null;
  nextCallDate: Date | null;
  avoidMonths: number | null;
  notes: string | null;
}) {
  return {
    grade: row.grade,
    resultCode: row.resultCode,
    resultDetail: row.resultDetail,
    contactName: row.contactName,
    interestLevel: row.interestLevel,
    nextCallDate: dateOnly(row.nextCallDate),
    avoidMonths: row.avoidMonths,
    notes: row.notes,
  };
}

/**
 * The detailed result must sit under the chosen grade; 「C架電回避目安」 only applies to
 * grade C, and sets the day the company comes back on the call list.
 */
function resultFields(input: CreateCallRecordRequest, calledAt: Date) {
  const resultCode = input.resultCode || null;
  if (resultCode && gradeOfResult(resultCode) !== input.grade) {
    throw new ValidationError({ resultCode: ['not_under_grade'] });
  }
  const avoidMonths = input.grade === 'C' ? (input.avoidMonths ?? null) : null;
  return {
    resultCode,
    avoidMonths,
    avoidUntil: avoidMonths ? toDbDate(addMonthsToDate(jstDate(calledAt), avoidMonths)) : null,
  };
}

/** Call results (spec §6, request 10/29): grade A–E, detailed result, B次回架電日, C架電回避目安. */
export class CallRecordService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly policy: AccessPolicy,
    private readonly audit: AuditLogger,
    private readonly clock: Clock,
  ) {}

  async listForCompany(actor: Actor, companyId: string): Promise<CallRecordDto[]> {
    const rows = await this.prisma.callRecord.findMany({
      where: { companyId },
      include: recordInclude,
      orderBy: { calledAt: 'desc' },
    });
    return rows.map((row) => this.toDto(actor, row));
  }

  async get(actor: Actor, id: string): Promise<CallRecordDto> {
    const row = await this.prisma.callRecord.findUnique({ where: { id }, include: recordInclude });
    if (!row) {
      throw new NotFoundError();
    }
    return this.toDto(actor, row);
  }

  async create(
    actor: Actor,
    companyId: string,
    input: CreateCallRecordRequest,
  ): Promise<CallRecordDto> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        // The call belongs to the newest list this company came in on.
        importRows: { orderBy: { createdAt: 'desc' }, take: 1, select: { listImportId: true } },
      },
    });
    if (!company) {
      throw new NotFoundError();
    }
    const calledAt = this.clock.now();
    const row = await this.prisma.callRecord.create({
      data: {
        companyId,
        telemarketerId: actor.id,
        calledAt,
        grade: input.grade,
        ...resultFields(input, calledAt),
        resultDetail: input.resultDetail ?? null,
        contactName: input.contactName ?? null,
        interestLevel: input.interestLevel ?? null,
        nextCallDate: input.nextCallDate ? toDbDate(input.nextCallDate) : null,
        notes: input.notes ?? null,
        listImportId: company.importRows[0]?.listImportId ?? null,
      },
      include: recordInclude,
    });
    await this.audit.record({
      action: AuditAction.CallRecordCreated,
      actorUserId: actor.id,
      targetType: 'call_record',
      targetId: row.id,
      after: { companyId, ...auditShape(row) },
    });
    return this.toDto(actor, row);
  }

  async update(actor: Actor, id: string, input: CreateCallRecordRequest): Promise<CallRecordDto> {
    const before = await this.prisma.callRecord.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundError();
    }
    if (!this.policy.canEditCallRecord(actor, before)) {
      throw new ForbiddenError();
    }
    const row = await this.prisma.callRecord.update({
      where: { id },
      data: {
        grade: input.grade,
        ...resultFields(input, before.calledAt),
        resultDetail: input.resultDetail ?? null,
        contactName: input.contactName ?? null,
        interestLevel: input.interestLevel ?? null,
        nextCallDate: input.nextCallDate ? toDbDate(input.nextCallDate) : null,
        notes: input.notes ?? null,
      },
      include: recordInclude,
    });
    await this.audit.record({
      action: AuditAction.CallRecordUpdated,
      actorUserId: actor.id,
      targetType: 'call_record',
      targetId: id,
      before: auditShape(before),
      after: auditShape(row),
    });
    return this.toDto(actor, row);
  }

  private toDto(actor: Actor, row: RecordRow): CallRecordDto {
    return {
      id: row.id,
      companyId: row.companyId,
      telemarketer: userRef(row.telemarketer),
      calledAt: iso(row.calledAt),
      grade: row.grade,
      resultCode: row.resultCode,
      resultDetail: row.resultDetail,
      contactName: row.contactName,
      interestLevel: row.interestLevel,
      nextCallDate: dateOnly(row.nextCallDate),
      avoidMonths: row.avoidMonths,
      avoidUntil: dateOnly(row.avoidUntil),
      notes: row.notes,
      commentCount: row._count.comments,
      canEdit: this.policy.canEditCallRecord(actor, row),
    };
  }
}
