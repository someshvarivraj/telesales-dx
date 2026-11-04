import {
  type CompanyDetail,
  type CompanyFields,
  CompanyFlag,
  type CompanyFilterCondition,
  type CompanyListItem,
  type CompanySearchRequest,
  jstDate,
  ListImportRowStatus,
  type Page,
  BLANK_VALUE,
  phoneDigitsOf,
  splitRange,
  type GroupDepartmentsRequest,
  type ResolveFlagRequest,
  type SetCallTargetRequest,
  type SetCallTargetResult,
  type UpdateCompanyRequest,
} from '@telesales/shared';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import type { Clock } from '../../domain/Clock.js';
import { splitJapaneseAddress } from '../../domain/area/japaneseAddress.js';
import { isSimilarNumber, normalizeCompanyName } from '../../domain/companies/duplicates.js';
import { keywordWhere } from '../../domain/companies/keywordSearch.js';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import {
  InvalidStateError,
  ValidationError,
  NotFoundError,
  VersionConflictError,
} from '../../http/errors/AppError.js';
import { dateOnly, iso, toDbDate, userRef, userRefSelect } from '../../http/mappers.js';

const listInclude = {
  callRecords: {
    orderBy: { calledAt: 'desc' },
    take: 1,
    select: {
      calledAt: true,
      grade: true,
      nextCallDate: true,
      avoidUntil: true,
      telemarketer: userRefSelect,
    },
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
    'postalCode',
    'address',
    'prefecture',
    'city',
    'nearestStation',
    'walkMinutes',
    'capital',
    'industry',
    'customerType',
    'clientNo',
    'listingStatus',
    'companyRank',
    'parentName',
    'companyGroupId',
  ];
  // 資本金 is a bigint in the database; the change log is JSON.
  return Object.fromEntries(
    keys.map((key) => {
      const value = company[key] ?? null;
      return [key, typeof value === 'bigint' ? Number(value) : value];
    }),
  );
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
    sourceUrl: fields.sourceUrl,
    postalCode: fields.postalCode,
    address: fields.address,
    prefecture: fields.prefecture ?? parts.prefecture,
    city: fields.city ?? parts.city,
    nearestStation: fields.nearestStation,
    walkMinutes: fields.walkMinutes,
    capital:
      fields.capital === undefined
        ? undefined
        : fields.capital === null
          ? null
          : BigInt(fields.capital),
    industry: fields.industry,
    customerType: fields.customerType,
    clientNo: fields.clientNo,
    listingStatus: fields.listingStatus,
    companyRank: fields.companyRank,
    parentName: fields.parentName,
    companyGroupId: fields.companyGroupId ?? null,
  };
}

/** The company register (企業台帳) and the call-target list of ①. */
export class CompanyService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditLogger,
    private readonly clock: Clock,
  ) {}

  /** `viewerId` is needed for "assigned to me today" (confirmed allocation). */
  async search(request: CompanySearchRequest, viewerId?: string): Promise<Page<CompanyListItem>> {
    const conditions = await Promise.all(request.conditions.map((c) => this.conditionToWhere(c)));
    const filters = conditions.filter((where): where is Prisma.CompanyWhereInput => where !== null);
    const where: Prisma.CompanyWhereInput = {
      AND: [
        request.nonTargetsOnly
          ? { isCallTarget: false }
          : request.callTargetsOnly
            ? { isCallTarget: true, flag: { not: CompanyFlag.Duplicate } }
            : {},
        request.assignedToMe && viewerId
          ? {
              allocations: {
                some: {
                  date: toDbDate(jstDate(this.clock.now())),
                  kind: 'CALL',
                  assigneeId: viewerId,
                  status: 'CONFIRMED',
                },
              },
            }
          : {},
        filters.length === 0 ? {} : request.match === 'AND' ? { AND: filters } : { OR: filters },
        keywordWhere(request.keyword) ?? {},
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
        importRows: {
          orderBy: { createdAt: 'desc' },
          include: { listImport: { select: { id: true, listName: true, purpose: true } } },
        },
        // Copies from later lists flagged against this company, not yet merged by a lead:
        // their list names count as this company's too (request 10/29 ③ リスト取り込み ②).
        flaggedBy: {
          where: { flag: CompanyFlag.Duplicate },
          select: {
            importRows: {
              include: { listImport: { select: { id: true, listName: true, purpose: true } } },
            },
          },
        },
      },
    });
    if (!company) {
      throw new NotFoundError();
    }
    const sameName = await this.prisma.company.findMany({
      where: { nameKey: company.nameKey, id: { not: company.id } },
      select: {
        id: true,
        name: true,
        office: true,
        department: true,
        phone: true,
        phoneDigits: true,
        parentId: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    const rootId = company.parentId ?? company.id;
    const groupMembers = await this.prisma.company.findMany({
      where: { OR: [{ id: rootId }, { parentId: rootId }], id: { not: company.id } },
      select: { id: true, name: true, office: true, department: true, phone: true, parentId: true },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    const grouped = new Set(groupMembers.map((member) => member.id));
    const refOf = (other: (typeof groupMembers)[number]) => ({
      id: other.id,
      name: other.name,
      office: other.office,
      department: other.department,
      phone: other.phone,
      isGroupRoot: other.id === rootId,
    });
    const avoided = company.phoneDigits
      ? await this.prisma.avoidPhone.findUnique({
          where: { phoneDigits: company.phoneDigits },
          include: { createdBy: userRefSelect },
        })
      : null;
    return {
      ...this.toListItem(company),
      department: company.department,
      walkMinutes: company.walkMinutes,
      postalCode: company.postalCode,
      url: company.url,
      sourceUrl: company.sourceUrl,
      address: company.address,
      nearestStation: company.nearestStation,
      clientNo: company.clientNo,
      telemaIdNo: company.telemaIdNo,
      listingStatus: company.listingStatus,
      parentName: company.parentName,
      telemaMemo: company.telemaMemo,
      companyGroupId: company.companyGroupId,
      extra: (company.extra as Record<string, string> | null) ?? null,
      formerNames: company.formerNames.map((former) => former.name),
      avoided: avoided
        ? { by: userRef(avoided.createdBy), at: iso(avoided.createdAt), source: avoided.source }
        : null,
      groupMembers: groupMembers.map(refOf),
      sameNameCompanies: sameName.filter((other) => !grouped.has(other.id)).map(refOf),
      similarNumbers: sameName
        .filter((other) => isSimilarNumber(other.phoneDigits, company.phoneDigits))
        .map(({ id: otherId, name, phone }) => ({ id: otherId, name, phone })),
      flagMatches: company.flagMatch ? [company.flagMatch] : [],
      imports: [
        ...company.importRows,
        ...company.flaggedBy.flatMap((copy) =>
          copy.importRows.map((row) => ({ ...row, status: ListImportRowStatus.Duplicate })),
        ),
      ]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((row) => ({
          listImportId: row.listImport.id,
          listName: row.listImport.listName,
          purpose: row.listImport.purpose,
          rowNumber: row.rowNumber,
          status: row.status,
          importedAt: iso(row.createdAt),
        })),
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

  async updateTelemaMemo(
    actor: Actor,
    id: string,
    telemaMemo: string | null,
  ): Promise<CompanyDetail> {
    const before = await this.prisma.company.findUnique({
      where: { id },
      select: { telemaMemo: true },
    });
    if (!before) {
      throw new NotFoundError();
    }
    await this.prisma.company.update({ where: { id }, data: { telemaMemo } });
    await this.audit.record({
      action: AuditAction.CompanyUpdated,
      actorUserId: actor.id,
      targetType: 'company',
      targetId: id,
      before: { telemaMemo: before.telemaMemo },
      after: { telemaMemo },
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

  /**
   * A lead decides how a duplicate / check flag is handled (spec §4). MERGE treats the row as the
   * company it matched: the list history and any records move there and the flagged copy goes away,
   * so one company keeps its history across lists. Returns the company that remains.
   */
  async resolveFlag(actor: Actor, id: string, input: ResolveFlagRequest): Promise<CompanyDetail> {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        importRows: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { listImport: { select: { purpose: true } } },
        },
      },
    });
    if (!company) {
      throw new NotFoundError();
    }
    if (company.flag === CompanyFlag.None) {
      throw new InvalidStateError({ reason: 'not_flagged' });
    }
    if (input.action === 'MERGE') {
      return this.mergeInto(actor, company);
    }
    if (input.action === 'DEPARTMENT') {
      if (!company.flagMatchId) {
        throw new InvalidStateError({ reason: 'no_match' });
      }
      await this.groupDepartments(actor, company.flagMatchId, { companyIds: [company.id] });
    }
    const kept = input.action === 'KEEP' || input.action === 'DEPARTMENT';
    const callable = kept && company.importRows[0]?.listImport.purpose === 'CALL_REQUEST';
    await this.prisma.company.update({
      where: { id },
      data: {
        flag: CompanyFlag.None,
        isCallTarget: kept ? callable || company.isCallTarget : false,
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

  /**
   * 架電対象 ⇄ 架電対象外 (request 11/2: lists registered for later are moved in when it is their
   * turn). Numbers on the 回避企業 list and unresolved duplicates never move in.
   */
  async setCallTargets(actor: Actor, input: SetCallTargetRequest): Promise<SetCallTargetResult> {
    const companies = await this.prisma.company.findMany({
      where: { id: { in: input.companyIds } },
      select: { id: true, phoneDigits: true, flag: true, isCallTarget: true },
    });
    let movable = companies.filter((company) => company.isCallTarget !== input.isCallTarget);
    if (input.isCallTarget) {
      const avoided = new Set(
        (
          await this.prisma.avoidPhone.findMany({
            where: {
              phoneDigits: {
                in: movable.flatMap((company) =>
                  company.phoneDigits ? [company.phoneDigits] : [],
                ),
              },
            },
            select: { phoneDigits: true },
          })
        ).map((entry) => entry.phoneDigits),
      );
      movable = movable.filter(
        (company) =>
          company.flag !== CompanyFlag.Duplicate &&
          !(company.phoneDigits && avoided.has(company.phoneDigits)),
      );
    }
    const ids = movable.map((company) => company.id);
    await this.prisma.company.updateMany({
      where: { id: { in: ids } },
      data: { isCallTarget: input.isCallTarget },
    });
    await this.audit.record({
      action: AuditAction.CompanyUpdated,
      actorUserId: actor.id,
      targetType: 'company',
      metadata: { companyIds: ids },
      after: { isCallTarget: input.isCallTarget },
    });
    const unchanged = companies.filter((c) => c.isCallTarget === input.isCallTarget).length;
    return { changed: ids.length, skipped: companies.length - unchanged - ids.length };
  }

  /**
   * Same name, another department or office (request 11/2): the companies are kept apart (each has
   * its own phone and call history) but grouped under one company, shown together on its page.
   */
  async groupDepartments(
    actor: Actor,
    id: string,
    input: GroupDepartmentsRequest,
  ): Promise<CompanyDetail> {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { id: true, nameKey: true, parentId: true },
    });
    if (!company) {
      throw new NotFoundError();
    }
    const rootId = company.parentId ?? company.id;
    const others = await this.prisma.company.findMany({
      where: { id: { in: input.companyIds.filter((other) => other !== rootId) } },
      select: { id: true, nameKey: true },
    });
    if (others.some((other) => other.nameKey !== company.nameKey)) {
      throw new ValidationError({ companyIds: ['different_name'] });
    }
    const ids = others.map((other) => other.id);
    await this.prisma.$transaction([
      // A company that headed its own group brings its departments along.
      this.prisma.company.updateMany({
        where: { parentId: { in: ids } },
        data: { parentId: rootId },
      }),
      this.prisma.company.updateMany({ where: { id: { in: ids } }, data: { parentId: rootId } }),
    ]);
    await this.audit.record({
      action: AuditAction.CompanyUpdated,
      actorUserId: actor.id,
      targetType: 'company',
      targetId: rootId,
      metadata: { groupedDepartments: ids },
    });
    return this.get(id);
  }

  /** Takes one company out of its group. */
  async ungroup(actor: Actor, id: string): Promise<CompanyDetail> {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { id: true, parentId: true },
    });
    if (!company) {
      throw new NotFoundError();
    }
    if (company.parentId) {
      await this.prisma.company.update({ where: { id }, data: { parentId: null } });
    } else {
      // The head of the group leaves: the oldest department heads it instead.
      const [next, ...rest] = await this.prisma.company.findMany({
        where: { parentId: id },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (next) {
        await this.prisma.$transaction([
          this.prisma.company.update({ where: { id: next.id }, data: { parentId: null } }),
          this.prisma.company.updateMany({
            where: { id: { in: rest.map((r) => r.id) } },
            data: { parentId: next.id },
          }),
        ]);
      }
    }
    await this.audit.record({
      action: AuditAction.CompanyUpdated,
      actorUserId: actor.id,
      targetType: 'company',
      targetId: id,
      before: { parentId: company.parentId },
      after: { parentId: null },
    });
    return this.get(id);
  }

  private async mergeInto(
    actor: Actor,
    company: { id: string; name: string; flag: CompanyFlag; flagMatchId: string | null },
  ): Promise<CompanyDetail> {
    const targetId = company.flagMatchId;
    if (!targetId) {
      throw new InvalidStateError({ reason: 'no_match' });
    }
    const moved = await this.prisma.$transaction(async (tx) => {
      const from = { companyId: company.id };
      const to = { companyId: targetId };
      const counts = {
        importRows: (await tx.listImportRow.updateMany({ where: from, data: to })).count,
        callRecords: (await tx.callRecord.updateMany({ where: from, data: to })).count,
        appointments: (await tx.appointment.updateMany({ where: from, data: to })).count,
        allocations: (await tx.allocation.updateMany({ where: from, data: to })).count,
        formerNames: (await tx.companyFormerName.updateMany({ where: from, data: to })).count,
      };
      await tx.company.updateMany({
        where: { parentId: company.id },
        data: { parentId: targetId },
      });
      await tx.company.updateMany({
        where: { flagMatchId: company.id },
        data: { flagMatchId: targetId },
      });
      await tx.company.delete({ where: { id: company.id } });
      return counts;
    });
    await this.audit.record({
      action: AuditAction.CompanyMerged,
      actorUserId: actor.id,
      targetType: 'company',
      targetId,
      before: { mergedCompanyId: company.id, name: company.name, flag: company.flag },
      after: { companyId: targetId, moved },
    });
    return this.get(targetId);
  }

  /** Cities registered so far, to pick from when searching by address. */
  async cityNames(): Promise<string[]> {
    const rows = await this.prisma.company.findMany({
      where: { city: { not: null } },
      distinct: ['city'],
      orderBy: { city: 'asc' },
      select: { city: true },
    });
    return rows.flatMap((row) => (row.city ? [row.city] : []));
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
      companyRank: row.companyRank,
      capital: row.capital === null ? null : Number(row.capital),
      isCallTarget: row.isCallTarget,
      lastCall: last
        ? {
            calledAt: iso(last.calledAt),
            grade: last.grade,
            telemarketer: userRef(last.telemarketer),
            avoidUntil: dateOnly(last.avoidUntil),
          }
        : null,
      nextCallDate: dateOnly(last?.nextCallDate ?? null),
    };
  }

  private async conditionToWhere(
    condition: CompanyFilterCondition,
  ): Promise<Prisma.CompanyWhereInput | null> {
    const value = condition.value.trim();
    // A condition holds one value or several picks; a company matches any of them.
    const picks = condition.values.length > 0 ? condition.values : value ? [value] : [];
    const words = picks.filter((pick) => pick !== BLANK_VALUE);
    const blank = picks.includes(BLANK_VALUE);
    /** Equal to one of the picks, or empty when 「空白」 is picked. */
    const exactly = (field: 'industry' | 'companyRank' | 'prefecture' | 'customerType') =>
      picks.length === 0
        ? null
        : {
            OR: [
              { [field]: { in: words } },
              ...(blank ? [{ [field]: null }, { [field]: '' }] : []),
            ],
          };
    /** Contains one of the picks, in any of these fields. */
    const containing = (
      ...fields: ('office' | 'department' | 'address' | 'city' | 'prefecture')[]
    ) =>
      picks.length === 0
        ? null
        : {
            OR: [
              ...words.flatMap((word) =>
                fields.map((field) => ({
                  [field]: { contains: word, mode: 'insensitive' as const },
                })),
              ),
              ...(blank ? [{ [fields[0] as string]: null }, { [fields[0] as string]: '' }] : []),
            ],
          };
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
        return exactly('prefecture');
      case 'city':
        return containing('city');
      case 'industry':
        return exactly('industry');
      case 'office':
        return containing('office');
      case 'department':
        return containing('department');
      case 'address':
        // 「大阪市」「神戸市」: the city is also kept apart from the written address.
        return containing('address', 'city', 'prefecture');
      case 'postalCode':
        return value
          ? {
              OR: [
                { postalCode: { contains: value } },
                { postalCode: { contains: value.replace(/\D/g, '') || value } },
              ],
            }
          : null;
      case 'nearestStation':
        return value ? { nearestStation: { contains: value, mode: 'insensitive' } } : null;
      case 'phone': {
        if (!value) return null;
        const digits = phoneDigitsOf(value);
        return {
          OR: [
            { phone: { contains: value } },
            ...(digits ? [{ phoneDigits: { contains: digits } }] : []),
          ],
        };
      }
      case 'remarks': {
        if (!value) return null;
        const has = { contains: value, mode: 'insensitive' as const };
        return {
          OR: [
            { telemaMemo: has },
            { callRecords: { some: { OR: [{ notes: has }, { resultDetail: has }] } } },
          ],
        };
      }
      case 'salesRep': {
        const ids = words.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
        return ids.length > 0 ? { appointments: { some: { salesRepId: { in: ids } } } } : null;
      }
      case 'visitDate': {
        const range = dateRange(value);
        if (!range) return null;
        return {
          appointments: {
            some: {
              status: { not: 'CANCELLED' },
              startsAt: {
                ...(range.from ? { gte: jstDayStart(range.from) } : {}),
                ...(range.to ? { lt: jstDayStart(nextDay(range.to)) } : {}),
              },
            },
          },
        };
      }
      case 'capital': {
        const { from, to } = splitRange(value);
        const low = /^\d{1,15}$/.test(from) ? BigInt(from) : null;
        const high = /^\d{1,15}$/.test(to) ? BigInt(to) : null;
        if (low === null && high === null) return null;
        return {
          capital: {
            ...(low !== null ? { gte: low } : {}),
            ...(high !== null ? { lte: high } : {}),
          },
        };
      }
      case 'headOffice':
        return { office: { contains: '本社' } };
      case 'visitCancelled':
        return { appointments: { some: { status: 'CANCELLED' } } };
      case 'listName':
        // A company can be on several lists; its own listName is the first one.
        return value
          ? {
              OR: [
                { listName: { contains: value, mode: 'insensitive' } },
                {
                  importRows: {
                    some: { listImport: { listName: { contains: value, mode: 'insensitive' } } },
                  },
                },
              ],
            }
          : null;
      case 'customerType':
        return exactly('customerType');
      case 'flag':
        return words.length > 0 ? { flag: { in: words as CompanyFlag[] } } : null;
      case 'neverCalled':
        return { callRecords: { none: {} } };
      case 'lastGrade': {
        if (picks.length === 0) return null;
        // A grade (「B」) or a result under it (「B-01」); 空白 = not called yet.
        const ids = await this.companyIdsByLatestCall(
          Prisma.sql`(grade = ANY(${words}::text[]) OR result_code = ANY(${words}::text[]))`,
        );
        return {
          OR: [{ id: { in: ids } }, ...(blank ? [{ callRecords: { none: {} } }] : [])],
        };
      }
      case 'companyRank':
        return exactly('companyRank');
      case 'telemarketer': {
        const people = words.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
        if (people.length === 0) return null;
        const ids = await this.companyIdsByLatestCall(
          Prisma.sql`telemarketer_id = ANY(${people}::uuid[])`,
        );
        return { id: { in: ids } };
      }
      case 'telemaIdNo': {
        const { from, to } = splitRange(value);
        const low = /^\d{1,15}$/.test(from) ? BigInt(from) : null;
        const high = /^\d{1,15}$/.test(to) ? BigInt(to) : null;
        if (low === null && high === null) {
          return from ? { telemaIdNo: { contains: from } } : null;
        }
        const bounds = [
          Prisma.sql`telema_id_no ~ '^[0-9]{1,15}$'`,
          ...(low !== null ? [Prisma.sql`telema_id_no::bigint >= ${low}`] : []),
          ...(high !== null ? [Prisma.sql`telema_id_no::bigint <= ${high}`] : []),
        ];
        const rows = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM companies WHERE ${Prisma.join(bounds, ' AND ')}`;
        return { id: { in: rows.map((row) => row.id) } };
      }
      case 'lastCallDate': {
        const range = dateRange(value);
        if (!range) return null;
        const day = Prisma.sql`(called_at AT TIME ZONE 'Asia/Tokyo')::date`;
        const ids = await this.companyIdsByLatestCall(
          Prisma.join(
            [
              ...(range.from ? [Prisma.sql`${day} >= ${toDbDate(range.from)}`] : []),
              ...(range.to ? [Prisma.sql`${day} <= ${toDbDate(range.to)}`] : []),
            ],
            ' AND ',
          ),
        );
        return { id: { in: ids } };
      }
      case 'nextCallDate': {
        const range = dateRange(value);
        if (!range) return null;
        const ids = await this.companyIdsByLatestCall(
          Prisma.join(
            [
              ...(range.from ? [Prisma.sql`next_call_date >= ${toDbDate(range.from)}`] : []),
              ...(range.to ? [Prisma.sql`next_call_date <= ${toDbDate(range.to)}`] : []),
            ],
            ' AND ',
          ),
        );
        return { id: { in: ids } };
      }
      case 'importedDate': {
        const range = dateRange(value);
        if (!range) return null;
        return {
          importRows: {
            some: {
              listImport: {
                createdAt: {
                  ...(range.from ? { gte: jstDayStart(range.from) } : {}),
                  ...(range.to ? { lt: jstDayStart(nextDay(range.to)) } : {}),
                },
              },
            },
          },
        };
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
        SELECT DISTINCT ON (company_id)
          company_id, grade, result_code, next_call_date, telemarketer_id, called_at
        FROM call_records
        ORDER BY company_id, called_at DESC
      ) latest
      WHERE ${predicate}`;
    return rows.map((row) => row.company_id);
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A 「from~to」 day range; null when neither side is a date. */
function dateRange(value: string): { from: string | null; to: string | null } | null {
  const { from, to } = splitRange(value);
  const range = { from: DATE.test(from) ? from : null, to: DATE.test(to) ? to : null };
  return range.from || range.to ? range : null;
}

/** 00:00 JST of a day. */
function jstDayStart(date: string): Date {
  return new Date(`${date}T00:00:00+09:00`);
}

function nextDay(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}
