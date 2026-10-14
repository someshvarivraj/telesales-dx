import type { CallRecordDto, CreateCallRecordRequest } from '@telesales/shared';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { AccessPolicy, Actor } from '../../domain/access/AccessPolicy.js';
import type { Clock } from '../../domain/Clock.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { ForbiddenError, NotFoundError } from '../../http/errors/AppError.js';
import { dateOnly, iso, toDbDate, userRef, userRefSelect } from '../../http/mappers.js';

const recordInclude = {
  telemarketer: userRefSelect,
  _count: { select: { comments: { where: { deletedAt: null } } } },
} satisfies Prisma.CallRecordInclude;

type RecordRow = Prisma.CallRecordGetPayload<{ include: typeof recordInclude }>;

function auditShape(row: {
  grade: string;
  resultDetail: string | null;
  contactName: string | null;
  interestLevel: string | null;
  nextCallDate: Date | null;
  notes: string | null;
}) {
  return {
    grade: row.grade,
    resultDetail: row.resultDetail,
    contactName: row.contactName,
    interestLevel: row.interestLevel,
    nextCallDate: dateOnly(row.nextCallDate),
    notes: row.notes,
  };
}

/** Call results (spec §6): grade A–D, detail, next call date; past records on the same screen. */
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
      select: { id: true, listImportId: true },
    });
    if (!company) {
      throw new NotFoundError();
    }
    const row = await this.prisma.callRecord.create({
      data: {
        companyId,
        telemarketerId: actor.id,
        calledAt: this.clock.now(),
        grade: input.grade,
        resultDetail: input.resultDetail ?? null,
        contactName: input.contactName ?? null,
        interestLevel: input.interestLevel ?? null,
        nextCallDate: input.nextCallDate ? toDbDate(input.nextCallDate) : null,
        notes: input.notes ?? null,
        listImportId: company.listImportId,
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
      resultDetail: row.resultDetail,
      contactName: row.contactName,
      interestLevel: row.interestLevel,
      nextCallDate: dateOnly(row.nextCallDate),
      notes: row.notes,
      commentCount: row._count.comments,
      canEdit: this.policy.canEditCallRecord(actor, row),
    };
  }
}
