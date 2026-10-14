import {
  type CompanyDetail,
  type CompanyFields,
  CompanyFlag,
  type CompanyFilterCondition,
  type CompanyListItem,
  type CompanySearchRequest,
  type Page,
  phoneDigitsOf,
  type ResolveFlagRequest,
  type UpdateCompanyRequest,
} from '@telesales/shared';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import { splitJapaneseAddress } from '../../domain/area/japaneseAddress.js';
import { isSimilarNumber, normalizeCompanyName } from '../../domain/companies/duplicates.js';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import {
  InvalidStateError,
  NotFoundError,
  VersionConflictError,
} from '../../http/errors/AppError.js';
import { dateOnly, iso, toDbDate, userRef, userRefSelect } from '../../http/mappers.js';

const listInclude = {
  callRecords: {
    orderBy: { calledAt: 'desc' },
    take: 1,
    select: { calledAt: true, grade: true, nextCallDate: true, telemarketer: userRefSelect },
  },
} satisfies Prisma.CompanyInclude;

type CompanyWithLastCall = Prisma.CompanyGetPayload<{ include: typeof listInclude }>;

/** Company data written on edit, in a stable shape for the change log. */
function auditShape(company: Record<string, unknown>): Record<string, unknown> {
  const keys = [
    'name',
    'office',
    'department',
    'phone',
    'url',
    'address',
    'prefecture',
    'city',
    'nearestStation',
    'industry',
    'customerType',
    'clientNo',
    'listingStatus',
    'companyGroupId',
  ];
  return Object.fromEntries(keys.map((key) => [key, company[key] ?? null]));
}

/** Data for a company row from the editable fields (derived columns filled in). */
export function companyWriteData(fields: CompanyFields) {
  const parts = splitJapaneseAddress(fields.address);
  return {
    name: fields.name,
    nameKey: normalizeCompanyName(fields.name),
    office: fields.office,
    department: fields.department,
    phone: fields.phone,
    phoneDigits: phoneDigitsOf(fields.phone),
    url: fields.url,
    address: fields.address,
    prefecture: fields.prefecture ?? parts.prefecture,
    city: fields.city ?? parts.city,
    nearestStation: fields.nearestStation,
    industry: fields.industry,
    customerType: fields.customerType,
    clientNo: fields.clientNo,
    listingStatus: fields.listingStatus,
    companyGroupId: fields.companyGroupId ?? null,
  };
}

/** The company register (企業台帳) and the call-target list of ①. */
export class CompanyService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditLogger,
  ) {}

  async search(request: CompanySearchRequest): Promise<Page<CompanyListItem>> {
    const conditions = await Promise.all(request.conditions.map((c) => this.conditionToWhere(c)));
    const filters = conditions.filter((where): where is Prisma.CompanyWhereInput => where !== null);
    const where: Prisma.CompanyWhereInput = {
      AND: [
        request.callTargetsOnly ? { isCallTarget: true, flag: { not: CompanyFlag.Duplicate } } : {},
        filters.length === 0 ? {} : request.match === 'AND' ? { AND: filters } : { OR: filters },
      ],
    };
    const [total, rows] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        include: listInclude,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (request.page - 1) * request.pageSize,
        take: request.pageSize,
      }),
    ]);
    return {
      items: rows.map((row) => this.toListItem(row)),
      total,
      page: request.page,
      pageSize: request.pageSize,
    };
  }

  async get(id: string): Promise<CompanyDetail> {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        ...listInclude,
        formerNames: { orderBy: { changedAt: 'desc' } },
        flagMatch: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!company) {
      throw new NotFoundError();
    }
    const sameName = company.phoneDigits
      ? await this.prisma.company.findMany({
          where: { nameKey: company.nameKey, id: { not: company.id } },
          select: { id: true, name: true, phone: true, phoneDigits: true },
          take: 50,
        })
      : [];
    return {
      ...this.toListItem(company),
      department: company.department,
      url: company.url,
      address: company.address,
      nearestStation: company.nearestStation,
      clientNo: company.clientNo,
      telemaIdNo: company.telemaIdNo,
      listingStatus: company.listingStatus,
      companyGroupId: company.companyGroupId,
      extra: (company.extra as Record<string, string> | null) ?? null,
      formerNames: company.formerNames.map((former) => former.name),
      similarNumbers: sameName
        .filter((other) => isSimilarNumber(other.phoneDigits, company.phoneDigits))
        .map(({ id: otherId, name, phone }) => ({ id: otherId, name, phone })),
      flagMatches: company.flagMatch ? [company.flagMatch] : [],
      updatedAt: iso(company.updatedAt),
    };
  }

  async update(actor: Actor, id: string, input: UpdateCompanyRequest): Promise<CompanyDetail> {
    const before = await this.prisma.company.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundError();
    }
    if (before.updatedAt.toISOString() !== new Date(input.expectedUpdatedAt).toISOString()) {
      throw new VersionConflictError();
    }
    const data = companyWriteData(input);
    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({ where: { id }, data });
      // Renamed companies keep the former name for search and duplicate checks (spec §7).
      if (before.name !== input.name) {
        await tx.companyFormerName.create({
          data: { companyId: id, name: before.name, nameKey: before.nameKey },
        });
      }
    });
    await this.audit.record({
      action: AuditAction.CompanyUpdated,
      actorUserId: actor.id,
      targetType: 'company',
      targetId: id,
      before: auditShape(before),
      after: auditShape({ ...before, ...data }),
    });
    return this.get(id);
  }

  async listFlagged(): Promise<CompanyDetail[]> {
    const rows = await this.prisma.company.findMany({
      where: { flag: { not: CompanyFlag.None } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { id: true },
    });
    return Promise.all(rows.map((row) => this.get(row.id)));
  }

  /** A lead decides how a duplicate / check flag is handled (spec §4). */
  async resolveFlag(actor: Actor, id: string, input: ResolveFlagRequest): Promise<CompanyDetail> {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { listImport: { select: { purpose: true } } },
    });
    if (!company) {
      throw new NotFoundError();
    }
    if (company.flag === CompanyFlag.None) {
      throw new InvalidStateError({ reason: 'not_flagged' });
    }
    const callable = input.action === 'KEEP' && company.listImport?.purpose === 'CALL_REQUEST';
    await this.prisma.company.update({
      where: { id },
      data: {
        flag: CompanyFlag.None,
        isCallTarget: input.action === 'KEEP' ? callable || company.isCallTarget : false,
      },
    });
    await this.audit.record({
      action: AuditAction.CompanyFlagResolved,
      actorUserId: actor.id,
      targetType: 'company',
      targetId: id,
      before: { flag: company.flag, isCallTarget: company.isCallTarget },
      after: { flag: CompanyFlag.None, action: input.action },
    });
    return this.get(id);
  }

  async listNames(): Promise<string[]> {
    const rows = await this.prisma.company.findMany({
      where: { listName: { not: null } },
      distinct: ['listName'],
      select: { listName: true },
      orderBy: { listName: 'asc' },
      take: 500,
    });
    return rows.flatMap((row) => (row.listName ? [row.listName] : []));
  }

  private toListItem(row: CompanyWithLastCall): CompanyListItem {
    const last = row.callRecords[0];
    return {
      id: row.id,
      name: row.name,
      office: row.office,
      phone: row.phone,
      prefecture: row.prefecture,
      city: row.city,
      industry: row.industry,
      customerType: row.customerType,
      listName: row.listName,
      flag: row.flag,
      isCallTarget: row.isCallTarget,
      lastCall: last
        ? {
            calledAt: iso(last.calledAt),
            grade: last.grade,
            telemarketer: userRef(last.telemarketer),
          }
        : null,
      nextCallDate: dateOnly(last?.nextCallDate ?? null),
    };
  }

  private async conditionToWhere(
    condition: CompanyFilterCondition,
  ): Promise<Prisma.CompanyWhereInput | null> {
    const value = condition.value.trim();
    switch (condition.field) {
      case 'name': {
        if (!value) return null;
        const key = normalizeCompanyName(value);
        return {
          OR: [
            { nameKey: { contains: key } },
            { name: { contains: value, mode: 'insensitive' } },
            { formerNames: { some: { nameKey: { contains: key } } } },
          ],
        };
      }
      case 'prefecture':
        return value ? { prefecture: value } : null;
      case 'city':
        return value ? { city: { contains: value } } : null;
      case 'industry':
        return value ? { industry: { contains: value, mode: 'insensitive' } } : null;
      case 'listName':
        return value ? { listName: { contains: value, mode: 'insensitive' } } : null;
      case 'customerType':
        return value ? { customerType: value } : null;
      case 'flag':
        return value ? { flag: value as CompanyFlag } : null;
      case 'neverCalled':
        return { callRecords: { none: {} } };
      case 'lastGrade': {
        if (!value) return null;
        const ids = await this.companyIdsByLatestCall(Prisma.sql`grade = ${value}`);
        return { id: { in: ids } };
      }
      case 'nextCallDue': {
        const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? value
          : new Date().toISOString().slice(0, 10);
        const ids = await this.companyIdsByLatestCall(
          Prisma.sql`next_call_date <= ${toDbDate(date)}`,
        );
        return { id: { in: ids } };
      }
    }
  }

  /** Companies whose most recent call record matches the predicate. */
  private async companyIdsByLatestCall(predicate: Prisma.Sql): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ company_id: string }[]>`
      SELECT company_id FROM (
        SELECT DISTINCT ON (company_id) company_id, grade, next_call_date
        FROM call_records
        ORDER BY company_id, called_at DESC
      ) latest
      WHERE ${predicate}`;
    return rows.map((row) => row.company_id);
  }
}
