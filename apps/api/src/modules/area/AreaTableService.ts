import {
  type AreaRuleDto,
  type AreaRuleRequest,
  type CompanyGroupDto,
  type FindRepRequest,
  jstDate,
  type RepSuggestion,
} from '@telesales/shared';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import { splitJapaneseAddress } from '../../domain/area/japaneseAddress.js';
import { type AreaRule, RepFinder } from '../../domain/area/RepFinder.js';
import type { Clock } from '../../domain/Clock.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { ConflictError, NotFoundError } from '../../http/errors/AppError.js';
import { dateOnly, toDbDate, userRef, userRefSelect } from '../../http/mappers.js';

const ruleInclude = {
  salesRep: userRefSelect,
  backupRep: userRefSelect,
  companyGroup: { select: { id: true, name: true } },
} satisfies Prisma.SalesAreaRuleInclude;

type RuleRow = Prisma.SalesAreaRuleGetPayload<{ include: typeof ruleInclude }>;

function toDto(row: RuleRow): AreaRuleDto {
  return {
    id: row.id,
    prefecture: row.prefecture,
    city: row.city,
    customerTypeCondition:
      (row.customerTypeCondition as AreaRuleDto['customerTypeCondition']) ?? null,
    companyGroup: row.companyGroup,
    salesRep: userRef(row.salesRep),
    backupRep: userRef(row.backupRep),
    webOnly: row.webOnly,
    validFrom: dateOnly(row.validFrom),
    validTo: dateOnly(row.validTo),
  };
}

function toRule(row: RuleRow): AreaRule {
  const dto = toDto(row);
  return {
    id: dto.id,
    prefecture: dto.prefecture,
    city: dto.city,
    customerTypeCondition: dto.customerTypeCondition,
    companyGroupId: dto.companyGroup?.id ?? null,
    salesRepId: dto.salesRep.id,
    backupRepId: dto.backupRep?.id ?? null,
    webOnly: dto.webOnly,
    validFrom: dto.validFrom,
    validTo: dto.validTo,
  };
}

const CONDITION_LABEL = { CURRENT: '現取', NOT_CURRENT: '現取以外' } as const;

/**
 * The sales area table (営業担当表): kept as data and edited by admins and the person
 * entrusted with it (spec §4, §10), and used to suggest the rep before calling (spec §7).
 */
export class AreaTableService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditLogger,
    private readonly clock: Clock,
  ) {}

  async listRules(): Promise<AreaRuleDto[]> {
    const rows = await this.prisma.salesAreaRule.findMany({
      include: ruleInclude,
      orderBy: [{ prefecture: 'asc' }, { city: 'asc' }, { validFrom: 'desc' }],
    });
    return rows.map(toDto);
  }

  async createRule(actor: Actor, input: AreaRuleRequest): Promise<AreaRuleDto> {
    const row = await this.prisma.salesAreaRule.create({
      data: this.toData(input),
      include: ruleInclude,
    });
    await this.record(actor, row.id, undefined, toDto(row));
    return toDto(row);
  }

  async updateRule(actor: Actor, id: string, input: AreaRuleRequest): Promise<AreaRuleDto> {
    const before = await this.prisma.salesAreaRule.findUnique({
      where: { id },
      include: ruleInclude,
    });
    if (!before) {
      throw new NotFoundError();
    }
    const row = await this.prisma.salesAreaRule.update({
      where: { id },
      data: this.toData(input),
      include: ruleInclude,
    });
    await this.record(actor, id, toDto(before), toDto(row));
    return toDto(row);
  }

  async deleteRule(actor: Actor, id: string): Promise<void> {
    const before = await this.prisma.salesAreaRule.findUnique({
      where: { id },
      include: ruleInclude,
    });
    if (!before) {
      throw new NotFoundError();
    }
    await this.prisma.salesAreaRule.delete({ where: { id } });
    await this.record(actor, id, toDto(before), undefined);
  }

  async listGroups(): Promise<CompanyGroupDto[]> {
    return this.prisma.companyGroup.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, isActive: true },
    });
  }

  async saveGroup(
    actor: Actor,
    id: string | null,
    input: { name: string; isActive: boolean },
  ): Promise<CompanyGroupDto> {
    const clash = await this.prisma.companyGroup.findFirst({
      where: { name: input.name, ...(id ? { id: { not: id } } : {}) },
    });
    if (clash) {
      throw new ConflictError({ reason: 'name_exists' });
    }
    const row = id
      ? await this.prisma.companyGroup.update({ where: { id }, data: input })
      : await this.prisma.companyGroup.create({ data: input });
    await this.audit.record({
      action: AuditAction.SettingsChanged,
      actorUserId: actor.id,
      targetType: 'company_group',
      targetId: row.id,
      after: input,
    });
    return { id: row.id, name: row.name, isActive: row.isActive };
  }

  /** Suggests the rep; the telemarketer can still pick someone else (spec §7). */
  async findRep(input: FindRepRequest): Promise<RepSuggestion> {
    let query = {
      prefecture: input.prefecture ?? null,
      city: input.city ?? null,
      customerType: input.customerType ?? null,
      companyGroupId: input.companyGroupId ?? null,
    };
    if (input.companyId) {
      const company = await this.prisma.company.findUnique({ where: { id: input.companyId } });
      if (!company) {
        throw new NotFoundError();
      }
      const parts = splitJapaneseAddress(company.address);
      query = {
        prefecture: input.prefecture ?? company.prefecture ?? parts.prefecture,
        city: input.city ?? company.city ?? parts.city,
        customerType: input.customerType ?? company.customerType,
        companyGroupId: input.companyGroupId ?? company.companyGroupId,
      };
    }
    const rows = await this.prisma.salesAreaRule.findMany({ include: ruleInclude });
    const finder = new RepFinder(rows.map(toRule));
    const match = finder.find({ ...query, date: jstDate(this.clock.now()) });
    if (!match) {
      return { rep: null, backup: null, webOnly: false, ruleId: null, matchedBy: null };
    }
    const row = rows.find((candidate) => candidate.id === match.id);
    if (!row) {
      return { rep: null, backup: null, webOnly: false, ruleId: null, matchedBy: null };
    }
    const reason = [
      row.companyGroup?.name,
      [row.prefecture, row.city].filter(Boolean).join(' '),
      row.customerTypeCondition
        ? CONDITION_LABEL[row.customerTypeCondition as keyof typeof CONDITION_LABEL]
        : null,
    ]
      .filter(Boolean)
      .join(' ／ ');
    return {
      rep: userRef(row.salesRep),
      backup: userRef(row.backupRep),
      webOnly: row.webOnly,
      ruleId: row.id,
      matchedBy: reason,
    };
  }

  private toData(input: AreaRuleRequest) {
    return {
      prefecture: input.prefecture,
      city: input.city ?? null,
      customerTypeCondition: input.customerTypeCondition ?? null,
      companyGroupId: input.companyGroupId ?? null,
      salesRepId: input.salesRepId,
      backupRepId: input.backupRepId ?? null,
      webOnly: input.webOnly ?? false,
      validFrom: toDbDate(input.validFrom),
      validTo: input.validTo ? toDbDate(input.validTo) : null,
    };
  }

  private record(actor: Actor, id: string, before?: AreaRuleDto, after?: AreaRuleDto) {
    return this.audit.record({
      action: AuditAction.SettingsChanged,
      actorUserId: actor.id,
      targetType: 'sales_area_rule',
      targetId: id,
      before: before as unknown as Record<string, unknown> | undefined,
      after: after as unknown as Record<string, unknown> | undefined,
    });
  }
}
