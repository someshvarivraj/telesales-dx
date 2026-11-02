import {
  type AvoidListImportResult,
  type AvoidListQuery,
  type AvoidPhoneDto,
  type AvoidSource,
  CompanyFlag,
  fixPhone,
  PHONE_DIGITS_PATTERN,
  phoneDigitsOf,
} from '@telesales/shared';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { FileUnreadableError, NotFoundError, ValidationError } from '../../http/errors/AppError.js';
import { iso, userRef, userRefSelect } from '../../http/mappers.js';
import { decodeJapaneseText } from '../calendar/HolidayCsvParser.js';
import type { UploadedFile } from '../files/FileService.js';

type Entry = Prisma.AvoidPhoneGetPayload<{ include: { createdBy: typeof userRefSelect } }>;

/** A cell that is a phone number and nothing else (any hyphens, full-width digits). */
function phoneIn(text: string): string | null {
  if (!/^[\d\s０-９()（）‐‑‒–—―−ーｰ－-]+$/.test(text)) return null;
  const phone = fixPhone(text);
  return PHONE_DIGITS_PATTERN.test(phoneDigitsOf(phone) ?? '') ? phone : null;
}

/**
 * The team's 回避企業電話番号.xlsx has no header row (a title in row 1, the company in A and
 * the phone in D), so each row is read as: the first phone-number cell, and the first text
 * cell before it as the company. The sheet named 「回避」 is used when there is one.
 */
async function readAvoidFile(
  upload: UploadedFile,
): Promise<{ phone: string; name: string | null }[]> {
  const rows: string[][] = [];
  const lower = upload.originalname.toLowerCase();
  if (lower.endsWith('.xlsx')) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(upload.buffer as unknown as ArrayBuffer);
    } catch {
      throw new FileUnreadableError({ reason: 'broken_file' });
    }
    const sheet = workbook.getWorksheet('回避') ?? workbook.worksheets[0];
    sheet?.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, column) => {
        cells[column - 1] = cell.text.trim();
      });
      rows.push(Array.from(cells, (cell) => cell ?? ''));
    });
  } else if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    try {
      rows.push(
        ...(parse(decodeJapaneseText(upload.buffer), {
          relax_column_count: true,
          skip_empty_lines: true,
          bom: true,
        }) as string[][]),
      );
    } catch {
      throw new FileUnreadableError({ reason: 'broken_csv' });
    }
  } else {
    throw new FileUnreadableError({ reason: 'unsupported_type' });
  }

  const result: { phone: string; name: string | null }[] = [];
  for (const cells of rows) {
    const index = cells.findIndex((cell) => phoneIn(cell));
    if (index < 0) continue;
    const name = cells.slice(0, index).find((cell) => cell && !phoneIn(cell)) ?? null;
    result.push({ phone: phoneIn(cells[index] ?? '') ?? '', name: name?.slice(0, 200) ?? null });
  }
  return result;
}

/**
 * 回避企業 (Sano 10/28 ⑥⑦, 10/30): numbers never called or imported again. The team's list is
 * loaded once; after that anyone who calls can add a company from the call screen, and only a
 * lead or an admin can take one off. A number added takes every company with that number out of
 * the call targets; taking it off puts exactly those companies back.
 */
export class AvoidListService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditLogger,
  ) {}

  async list(query: AvoidListQuery): Promise<AvoidPhoneDto[]> {
    const digits = phoneDigitsOf(query.keyword);
    const rows = await this.prisma.avoidPhone.findMany({
      where: query.keyword
        ? {
            OR: [
              { companyName: { contains: query.keyword, mode: 'insensitive' } },
              ...(digits ? [{ phoneDigits: { contains: digits } }] : []),
            ],
          }
        : {},
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: { createdBy: userRefSelect },
    });
    return rows.map((row) => this.toDto(row));
  }

  async importFile(actor: Actor, upload: UploadedFile): Promise<AvoidListImportResult> {
    const read = await readAvoidFile(upload);
    if (read.length === 0) {
      throw new FileUnreadableError({ reason: 'no_phone_numbers' });
    }
    const byDigits = new Map<string, { phone: string; name: string | null }>();
    for (const entry of read) {
      const digits = phoneDigitsOf(entry.phone);
      if (digits && !byDigits.has(digits)) byDigits.set(digits, entry);
    }
    const existing = new Set(
      (
        await this.prisma.avoidPhone.findMany({
          where: { phoneDigits: { in: [...byDigits.keys()] } },
          select: { phoneDigits: true },
        })
      ).map((entry) => entry.phoneDigits),
    );
    const added = [...byDigits].filter(([digits]) => !existing.has(digits));

    const untargeted = await this.prisma.$transaction(async (tx) => {
      const companies = await tx.company.findMany({
        where: { phoneDigits: { in: added.map(([digits]) => digits) }, isCallTarget: true },
        select: { id: true, phoneDigits: true },
      });
      await tx.avoidPhone.createMany({
        data: added.map(([phoneDigits, entry]) => ({
          phoneDigits,
          phone: entry.phone,
          companyName: entry.name,
          source: 'LIST' as AvoidSource,
          untargetedIds: companies.filter((c) => c.phoneDigits === phoneDigits).map((c) => c.id),
          createdById: actor.id,
        })),
        skipDuplicates: true,
      });
      await tx.company.updateMany({
        where: { id: { in: companies.map((company) => company.id) } },
        data: { isCallTarget: false },
      });
      return companies.length;
    });

    const result = {
      readCount: byDigits.size,
      addedCount: added.length,
      existingCount: byDigits.size - added.length,
      untargetedCount: untargeted,
    };
    await this.audit.record({
      action: AuditAction.AvoidListImported,
      actorUserId: actor.id,
      targetType: 'avoid_phone',
      after: { fileName: upload.originalname, ...result },
    });
    return result;
  }

  /** 「回避企業に追加」 on the call screen. Ticking an already listed number changes nothing. */
  async addCompany(actor: Actor, companyId: string): Promise<AvoidPhoneDto> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, phone: true, phoneDigits: true },
    });
    if (!company) {
      throw new NotFoundError();
    }
    if (!company.phoneDigits) {
      throw new ValidationError({ phone: ['required'] });
    }
    const phoneDigits = company.phoneDigits;
    const current = await this.prisma.avoidPhone.findUnique({
      where: { phoneDigits },
      include: { createdBy: userRefSelect },
    });
    if (current) {
      return this.toDto(current);
    }
    const entry = await this.prisma.$transaction(async (tx) => {
      const companies = await tx.company.findMany({
        where: { phoneDigits, isCallTarget: true },
        select: { id: true },
      });
      await tx.company.updateMany({
        where: { id: { in: companies.map((c) => c.id) } },
        data: { isCallTarget: false },
      });
      return tx.avoidPhone.create({
        data: {
          phoneDigits,
          phone: company.phone ?? phoneDigits,
          companyName: company.name,
          source: 'CALL',
          companyId: company.id,
          untargetedIds: companies.map((c) => c.id),
          createdById: actor.id,
        },
        include: { createdBy: userRefSelect },
      });
    });
    await this.audit.record({
      action: AuditAction.AvoidPhoneAdded,
      actorUserId: actor.id,
      targetType: 'company',
      targetId: company.id,
      after: {
        phone: entry.phone,
        companyName: entry.companyName,
        untargetedIds: entry.untargetedIds,
      },
    });
    return this.toDto(entry);
  }

  /** Lead or admin only (checked by the router): the companies taken out go back in. */
  async remove(actor: Actor, id: string): Promise<void> {
    const entry = await this.prisma.avoidPhone.findUnique({ where: { id } });
    if (!entry) {
      throw new NotFoundError();
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.avoidPhone.delete({ where: { id } });
      // A copy flagged as a duplicate meanwhile stays out until a lead resolves it.
      await tx.company.updateMany({
        where: { id: { in: entry.untargetedIds }, flag: { not: CompanyFlag.Duplicate } },
        data: { isCallTarget: true },
      });
    });
    await this.audit.record({
      action: AuditAction.AvoidPhoneRemoved,
      actorUserId: actor.id,
      targetType: entry.companyId ? 'company' : 'avoid_phone',
      targetId: entry.companyId ?? entry.id,
      before: {
        phone: entry.phone,
        companyName: entry.companyName,
        source: entry.source,
        addedBy: entry.createdById,
        addedAt: iso(entry.createdAt),
      },
    });
  }

  async removeForCompany(actor: Actor, companyId: string): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { phoneDigits: true },
    });
    const entry = company?.phoneDigits
      ? await this.prisma.avoidPhone.findUnique({ where: { phoneDigits: company.phoneDigits } })
      : null;
    if (!entry) {
      throw new NotFoundError();
    }
    await this.remove(actor, entry.id);
  }

  private toDto(row: Entry): AvoidPhoneDto {
    return {
      id: row.id,
      phone: row.phone,
      companyName: row.companyName,
      source: row.source,
      createdBy: userRef(row.createdBy),
      createdAt: iso(row.createdAt),
      untargetedCount: row.untargetedIds.length,
    };
  }
}
