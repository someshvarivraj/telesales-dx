import {
  CompanyFlag,
  type CommitListImportRequest,
  type ListImportDto,
  type ListImportPreview,
  ListImportPurpose,
  NoticeCode,
  OptionCategory,
  PHONE_DIGITS_PATTERN,
  phoneDigitsOf,
} from '@telesales/shared';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import { splitJapaneseAddress } from '../../domain/area/japaneseAddress.js';
import { normalizeCompanyName } from '../../domain/companies/duplicates.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { DuplicateFileError, FileUnreadableError } from '../../http/errors/AppError.js';
import { iso, userRef, userRefSelect } from '../../http/mappers.js';
import type { FileService, UploadedFile } from '../files/FileService.js';
import type { NotificationService } from '../notifications/NotificationService.js';
import type { OptionService } from '../options/OptionService.js';
import {
  fieldForHeader,
  LIST_FIELD_LABEL,
  type ListField,
  REQUIRED_LIST_FIELDS,
} from './listColumns.js';
import { readTableFile, type Table } from './TableFileReader.js';

interface AnalyzedRow {
  row: number;
  /** Validated: always present. */
  name: string;
  fields: Partial<Record<ListField, string>>;
  extra: Record<string, string>;
  phoneDigits: string;
  nameKey: string;
  flag: CompanyFlag;
  matchId: string | null;
  matchedName: string | null;
}

interface Analysis {
  columns: { header: string; field: string | null }[];
  valid: AnalyzedRow[];
  errors: { row: number; message: string }[];
  rowCount: number;
}

const MAX_ERRORS_SHOWN = 300;
const SAMPLE_SIZE = 20;

/**
 * New call lists (spec §9-1): read → show the person what was read (row errors,
 * duplicates) → they choose the purpose and register. Duplicates follow the spec §7 proposal:
 * same phone = duplicate (not called until resolved), same name only = check flag.
 */
export class ListImportService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly files: FileService,
    private readonly options: OptionService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditLogger,
  ) {}

  async preview(actor: Actor, upload: UploadedFile): Promise<ListImportPreview> {
    const table = await readTableFile(upload.originalname, upload.buffer);
    const stored = await this.files.store(upload, actor.id);
    await this.ensureNotImported(stored.sha256, stored.id);
    const analysis = await this.analyze(table);
    return {
      fileId: stored.id,
      fileName: stored.originalName,
      rowCount: analysis.rowCount,
      validCount: analysis.valid.length,
      duplicateCount: analysis.valid.filter((row) => row.flag === CompanyFlag.Duplicate).length,
      checkCount: analysis.valid.filter((row) => row.flag === CompanyFlag.NeedsCheck).length,
      errors: analysis.errors.slice(0, MAX_ERRORS_SHOWN),
      columns: analysis.columns,
      sample: analysis.valid.slice(0, SAMPLE_SIZE).map((row) => ({
        row: row.row,
        name: row.fields.name ?? '',
        phone: row.fields.phone ?? '',
        url: row.fields.url ?? '',
        flag: row.flag,
        matchedName: row.matchedName,
      })),
    };
  }

  async commit(actor: Actor, input: CommitListImportRequest): Promise<ListImportDto> {
    const { record, content } = await this.files.read(input.fileId);
    await this.ensureNotImported(record.sha256, record.id);
    // Re-read: the register may have changed since the preview.
    const analysis = await this.analyze(await readTableFile(record.originalName, content));
    if (analysis.valid.length === 0) {
      throw new FileUnreadableError({ reason: 'no_valid_rows' });
    }
    const customerTypes = await this.customerTypeCodes();
    const callRequest = input.purpose === ListImportPurpose.CallRequest;

    const created = await this.prisma.$transaction(
      async (tx) => {
        const listImport = await tx.listImport.create({
          data: {
            purpose: input.purpose,
            listName: input.listName,
            fileId: record.id,
            importedById: actor.id,
            rowCount: analysis.rowCount,
            createdCount: analysis.valid.length,
            duplicateCount: analysis.valid.filter((r) => r.flag === CompanyFlag.Duplicate).length,
            checkCount: analysis.valid.filter((r) => r.flag === CompanyFlag.NeedsCheck).length,
            errorCount: new Set(analysis.errors.map((e) => e.row)).size,
          },
          include: { importedBy: userRefSelect, file: true },
        });
        await tx.company.createMany({
          data: analysis.valid.map((row) =>
            this.toCompanyData(row, listImport.id, input, actor.id, customerTypes, callRequest),
          ),
        });
        return listImport;
      },
      { timeout: 60_000 },
    );

    await this.audit.record({
      action: AuditAction.ListImported,
      actorUserId: actor.id,
      targetType: 'list_import',
      targetId: created.id,
      after: {
        listName: created.listName,
        purpose: created.purpose,
        rowCount: created.rowCount,
        createdCount: created.createdCount,
        duplicateCount: created.duplicateCount,
        checkCount: created.checkCount,
        errorCount: created.errorCount,
      },
    });

    if (callRequest) {
      await this.notifications.notify({
        code: NoticeCode.CallListImported,
        title: `架電を依頼するリストが入りました：${created.listName}（${created.createdCount}件）`,
        linkPath: `/calls?list=${encodeURIComponent(created.listName)}`,
        actorId: actor.id,
      });
    }
    return this.toDto(created);
  }

  async list(): Promise<ListImportDto[]> {
    const rows = await this.prisma.listImport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { importedBy: userRefSelect, file: true },
    });
    return rows.map((row) => this.toDto(row));
  }

  private toDto(
    row: Prisma.ListImportGetPayload<{ include: { importedBy: typeof userRefSelect; file: true } }>,
  ): ListImportDto {
    return {
      id: row.id,
      purpose: row.purpose,
      listName: row.listName,
      fileName: row.file.originalName,
      fileId: row.fileId,
      importedBy: userRef(row.importedBy),
      rowCount: row.rowCount,
      createdCount: row.createdCount,
      duplicateCount: row.duplicateCount,
      checkCount: row.checkCount,
      errorCount: row.errorCount,
      createdAt: iso(row.createdAt),
    };
  }

  private toCompanyData(
    row: AnalyzedRow,
    listImportId: string,
    input: CommitListImportRequest,
    actorId: string,
    customerTypes: Map<string, string>,
    callRequest: boolean,
  ): Prisma.CompanyCreateManyInput {
    const address = row.fields.address ?? null;
    const parts = splitJapaneseAddress(address);
    const customerType = row.fields.customerType
      ? (customerTypes.get(row.fields.customerType) ?? null)
      : null;
    return {
      name: row.name,
      nameKey: row.nameKey,
      office: row.fields.office ?? null,
      department: row.fields.department ?? null,
      phone: row.fields.phone ?? null,
      phoneDigits: row.phoneDigits,
      url: row.fields.url ?? null,
      address,
      prefecture: row.fields.prefecture ?? parts.prefecture,
      city: row.fields.city ?? parts.city,
      nearestStation: row.fields.nearestStation ?? null,
      industry: row.fields.industry ?? null,
      customerType,
      clientNo: row.fields.clientNo ?? null,
      listName: input.listName,
      flag: row.flag,
      flagMatchId: row.matchId,
      // Duplicates stay out of the call targets until a lead resolves them.
      isCallTarget: callRequest && row.flag !== CompanyFlag.Duplicate,
      extra: Object.keys(row.extra).length > 0 ? row.extra : undefined,
      createdById: actorId,
      listImportId,
    };
  }

  /** Label (新規) or code (NEW) → code. */
  private async customerTypeCodes(): Promise<Map<string, string>> {
    const labels = await this.options.labels(OptionCategory.CustomerType);
    const result = new Map<string, string>();
    labels.forEach((label, code) => {
      result.set(label, code);
      result.set(code, code);
    });
    return result;
  }

  private async ensureNotImported(sha256: string, fileId: string): Promise<void> {
    const existing = await this.prisma.listImport.findFirst({
      where: { OR: [{ fileId }, { file: { sha256 } }] },
      select: { id: true, listName: true, createdAt: true },
    });
    if (existing) {
      throw new DuplicateFileError({
        listImportId: existing.id,
        listName: existing.listName,
        importedAt: iso(existing.createdAt),
      });
    }
  }

  private async analyze(table: Table): Promise<Analysis> {
    const columns = table.headers.map((header) => ({ header, field: fieldForHeader(header) }));
    const mapped = new Set(columns.map((column) => column.field).filter(Boolean));
    const missing = REQUIRED_LIST_FIELDS.filter((field) => !mapped.has(field));
    if (missing.length > 0) {
      throw new FileUnreadableError({
        reason: 'missing_columns',
        columns: missing.map((field) => LIST_FIELD_LABEL[field]),
      });
    }

    const errors: { row: number; message: string }[] = [];
    const candidates: AnalyzedRow[] = [];
    for (const { row, values } of table.rows) {
      const fields: Partial<Record<ListField, string>> = {};
      const extra: Record<string, string> = {};
      for (const column of columns) {
        const value = values[column.header] ?? '';
        if (column.field) {
          if (value) {
            fields[column.field as ListField] = value;
          }
        } else if (value) {
          extra[column.header] = value;
        }
      }
      const rowErrors = validateRow(fields);
      const phoneDigits = phoneDigitsOf(fields.phone);
      if (rowErrors.length > 0 || !fields.name || !phoneDigits) {
        rowErrors.forEach((message) => errors.push({ row, message: `${row}行目：${message}` }));
        continue;
      }
      candidates.push({
        row,
        name: fields.name,
        fields,
        extra,
        phoneDigits,
        nameKey: normalizeCompanyName(fields.name),
        flag: CompanyFlag.None,
        matchId: null,
        matchedName: null,
      });
    }

    await this.flagDuplicates(candidates);
    return { columns, valid: candidates, errors, rowCount: table.rows.length };
  }

  private async flagDuplicates(rows: AnalyzedRow[]): Promise<void> {
    const phones = [...new Set(rows.map((row) => row.phoneDigits))];
    const names = [...new Set(rows.map((row) => row.nameKey))];
    const [byPhone, byName, byFormerName] = await Promise.all([
      this.prisma.company.findMany({
        where: { phoneDigits: { in: phones } },
        select: { id: true, name: true, phoneDigits: true },
      }),
      this.prisma.company.findMany({
        where: { nameKey: { in: names } },
        select: { id: true, name: true, nameKey: true },
      }),
      this.prisma.companyFormerName.findMany({
        where: { nameKey: { in: names } },
        select: { nameKey: true, company: { select: { id: true, name: true } } },
      }),
    ]);
    const phoneMatch = new Map(byPhone.map((company) => [company.phoneDigits, company]));
    const nameMatch = new Map<string, { id: string; name: string }>();
    byName.forEach((company) => nameMatch.set(company.nameKey, company));
    byFormerName.forEach((former) => nameMatch.set(former.nameKey, former.company));

    const seenPhones = new Map<string, AnalyzedRow>();
    const seenNames = new Map<string, AnalyzedRow>();
    for (const row of rows) {
      const existingByPhone = phoneMatch.get(row.phoneDigits);
      const sameFilePhone = seenPhones.get(row.phoneDigits);
      if (existingByPhone) {
        row.flag = CompanyFlag.Duplicate;
        row.matchId = existingByPhone.id;
        row.matchedName = existingByPhone.name;
      } else if (sameFilePhone) {
        row.flag = CompanyFlag.Duplicate;
        row.matchedName = `${sameFilePhone.fields.name}（${sameFilePhone.row}行目）`;
      } else {
        const existingByName = nameMatch.get(row.nameKey);
        const sameFileName = seenNames.get(row.nameKey);
        if (existingByName) {
          row.flag = CompanyFlag.NeedsCheck;
          row.matchId = existingByName.id;
          row.matchedName = existingByName.name;
        } else if (sameFileName) {
          row.flag = CompanyFlag.NeedsCheck;
          row.matchedName = `${sameFileName.fields.name}（${sameFileName.row}行目）`;
        }
      }
      seenPhones.set(row.phoneDigits, row);
      seenNames.set(row.nameKey, row);
    }
  }
}

function validateRow(fields: Partial<Record<ListField, string>>): string[] {
  const errors: string[] = [];
  if (!fields.name) {
    errors.push('会社名が空です');
  }
  if (!fields.phone) {
    errors.push('電話番号が空です');
  } else if (!PHONE_DIGITS_PATTERN.test(phoneDigitsOf(fields.phone) ?? '')) {
    errors.push('電話番号は数字10〜11桁で入力してください');
  }
  if (!fields.url) {
    errors.push('URLが空です');
  } else if (!/^https?:\/\/\S+$/i.test(fields.url)) {
    errors.push('URLは http:// または https:// で始めてください');
  }
  return errors;
}
