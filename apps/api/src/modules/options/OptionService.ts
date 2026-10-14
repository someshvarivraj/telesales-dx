import type { OptionDto } from '@telesales/shared';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { ConflictError, NotFoundError } from '../../http/errors/AppError.js';

interface OptionRow {
  id: string;
  category: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

function toDto(row: OptionRow): OptionDto {
  return {
    id: row.id,
    category: row.category,
    code: row.code,
    label: row.label,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

/** Admin-managed choices. Options are disabled, never deleted (spec §5). */
export class OptionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditLogger,
  ) {}

  async list(includeInactive: boolean): Promise<OptionDto[]> {
    const rows = await this.prisma.optionItem.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
    });
    return rows.map(toDto);
  }

  /** code → label for one category, including disabled options so old records still display. */
  async labels(category: string): Promise<Map<string, string>> {
    const rows = await this.prisma.optionItem.findMany({ where: { category } });
    return new Map(rows.map((row) => [row.code, row.label]));
  }

  async create(
    actor: Actor,
    input: { category: string; code: string; label: string },
  ): Promise<OptionDto> {
    const existing = await this.prisma.optionItem.findUnique({
      where: { category_code: { category: input.category, code: input.code } },
    });
    if (existing) {
      throw new ConflictError({ reason: 'code_exists' });
    }
    const last = await this.prisma.optionItem.aggregate({
      where: { category: input.category },
      _max: { sortOrder: true },
    });
    const row = await this.prisma.optionItem.create({
      data: { ...input, sortOrder: (last._max.sortOrder ?? 0) + 1 },
    });
    await this.audit.record({
      action: AuditAction.SettingsChanged,
      actorUserId: actor.id,
      targetType: 'option',
      targetId: row.id,
      after: toDto(row) as unknown as Record<string, unknown>,
    });
    return toDto(row);
  }

  async update(
    actor: Actor,
    id: string,
    input: { label: string; isActive: boolean; sortOrder: number },
  ): Promise<OptionDto> {
    const before = await this.prisma.optionItem.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundError();
    }
    const row = await this.prisma.optionItem.update({ where: { id }, data: input });
    await this.audit.record({
      action: AuditAction.SettingsChanged,
      actorUserId: actor.id,
      targetType: 'option',
      targetId: id,
      before: toDto(before) as unknown as Record<string, unknown>,
      after: toDto(row) as unknown as Record<string, unknown>,
    });
    return toDto(row);
  }
}
