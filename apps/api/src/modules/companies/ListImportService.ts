import { randomUUID } from 'node:crypto';
import {
  CompanyFlag,
  type CommitListImportRequest,
  type ListImportDto,
  type ListImportPreview,
  ListImportPurpose,
  type ListImportRowDto,
  type ListImportRowsQuery,
  ListImportRowStatus,
  NoticeCode,
  OptionCategory,
  phoneDigitsOf,
  datedListName,
  jstDate,
  cleanListRow,
  type EditableListField,
  isSArea,
  isUnknownPhone,
  type ListImportProblemRow,
  type ListRowFix,
  splitCompanyRank,
  splitRankCell,
  UNKNOWN_URL,
  validateListRow,
  parseCapital,
  splitStation,
} from '@telesales/shared';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import { splitJapaneseAddress } from '../../domain/area/japaneseAddress.js';
import { normalizeCompanyName } from '../../domain/companies/duplicates.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import {
  DuplicateFileError,
  FileUnreadableError,
  InvalidStateError,
  NotFoundError,
} from '../../http/errors/AppError.js';
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
  /** Non-empty values as read, by header. */
  raw: Record<string, string>;
  /** Validated: always present. */
  name: string;
  fields: Partial<Record<ListField, string>>;
  extra: Record<string, string>;
  phoneDigits: string;
  nameKey: string;
  flag: CompanyFlag;
  matchId: string | null;
  matchedName: string | null;
  /** Generated before saving, so a row of the same file can be grouped under it. */
  id: string;
  /** Same name, another department / office: the company it can be grouped under. */
  departmentOf: string | null;
}

interface LeftOutRow {
  row: number;
  raw: Record<string, string>;
}

interface Analysis {
  headerRow: number;
  headers: string[];
  columns: { header: string; field: string | null }[];
  valid: AnalyzedRow[];
  problems: (ListImportProblemRow & LeftOutRow)[];
  avoided: (LeftOutRow & { name: string; phone: string })[];
  noPhone: LeftOutRow[];
  fixes: ({ row: number } & ListRowFix)[];
  fixedCount: number;
  sAreaCount: number;
  rowCount: number;
}

type RowFixes = CommitListImportRequest['fixes'];

const ROW_STATUS_OF: Record<CompanyFlag, ListImportRowStatus> = {
  [CompanyFlag.None]: ListImportRowStatus.Imported,
  [CompanyFlag.Duplicate]: ListImportRowStatus.Duplicate,
  [CompanyFlag.NeedsCheck]: ListImportRowStatus.NeedsCheck,
};

const MAX_PROBLEMS_SHOWN = 1000;
const SAMPLE_SIZE = 20;
const FIX_SAMPLES = 30;

/**
 * New call lists (spec §9-1): read → show the person what was read (row errors,
 * duplicates) → they choose the purpose and register. Duplicates follow the spec §7 proposal:
 * same phone = duplicate (not called until resolved), same name only = check flag.
 * Every row of the file is kept in list_import_rows with how it was judged, so a company
 * keeps its history across lists and past imports can be checked row by row.
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
    const analysis = await this.analyze(table, []);
    return {
      fileId: stored.id,
      fileName: stored.originalName,
      headerRow: analysis.headerRow,
      rowCount: analysis.rowCount,
      validCount: analysis.valid.length,
      duplicateCount: analysis.valid.filter((row) => row.flag === CompanyFlag.Duplicate).length,
      checkCount: analysis.valid.filter((row) => row.flag === CompanyFlag.NeedsCheck).length,
      avoided: analysis.avoided.map(({ row, name, phone }) => ({ row, name, phone })),
      noPhoneCount: analysis.noPhone.length,
      fixedCount: analysis.fixedCount,
      fixSamples: analysis.fixes.slice(0, FIX_SAMPLES),
      sAreaCount: analysis.sAreaCount,
      departmentCount: analysis.valid.filter((row) => row.departmentOf).length,
      problems: analysis.problems.slice(0, MAX_PROBLEMS_SHOWN),
      headers: analysis.headers,
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
    const analysis = await this.analyze(
      await readTableFile(record.originalName, content),
      input.fixes,
    );
    if (analysis.valid.length === 0) {
      throw new FileUnreadableError({ reason: 'no_valid_rows' });
    }
    // Same name, another department / office: grouped under that company instead of 要確認.
    if (input.groupDepartments) {
      for (const row of analysis.valid) {
        if (row.departmentOf && row.flag === CompanyFlag.NeedsCheck) {
          row.flag = CompanyFlag.None;
          row.matchId = null;
        }
      }
    }
    const listName = datedListName(input.listName, jstDate(new Date()));
    const customerTypes = await this.optionCodes(OptionCategory.CustomerType);
    const ranks = await this.optionCodes(OptionCategory.CompanyRank);
    const callRequest = input.purpose === ListImportPurpose.CallRequest;

    const created = await this.prisma.$transaction(
      async (tx) => {
        const listImport = await tx.listImport.create({
          data: {
            purpose: input.purpose,
            listName,
            autoAllocate: callRequest && input.autoAllocate,
            fileId: record.id,
            importedById: actor.id,
            rowCount: analysis.rowCount,
            createdCount: analysis.valid.length,
            duplicateCount: analysis.valid.filter((r) => r.flag === CompanyFlag.Duplicate).length,
            checkCount: analysis.valid.filter((r) => r.flag === CompanyFlag.NeedsCheck).length,
            errorCount: analysis.problems.length,
            avoidedCount: analysis.avoided.length,
            noPhoneCount: analysis.noPhone.length,
          },
          include: { importedBy: userRefSelect, file: true },
        });
        const companies = analysis.valid.map((row) => ({
          row,
          data: this.toCompanyData(
            row,
            { ...input, listName },
            actor.id,
            { customerTypes, ranks },
            callRequest,
          ),
        }));
        await tx.company.createMany({ data: companies.map((company) => company.data) });
        await tx.listImportRow.createMany({
          data: [
            ...companies.map(({ row, data }) => ({
              listImportId: listImport.id,
              companyId: data.id,
              rowNumber: row.row,
              rawData: row.raw,
              status: ROW_STATUS_OF[row.flag],
            })),
            ...analysis.problems.map((row) => ({
              listImportId: listImport.id,
              rowNumber: row.row,
              rawData: row.raw,
              status: ListImportRowStatus.Invalid,
              errorMessage: row.problems.map((problem) => problem.message).join('／'),
            })),
            ...analysis.avoided.map((row) => ({
              listImportId: listImport.id,
              rowNumber: row.row,
              rawData: row.raw,
              status: ListImportRowStatus.Avoided,
              errorMessage: '回避企業の電話番号',
            })),
            ...analysis.noPhone.map((row) => ({
              listImportId: listImport.id,
              rowNumber: row.row,
              rawData: row.raw,
              status: ListImportRowStatus.NoPhone,
              errorMessage: '電話番号が空か「不明」',
            })),
          ],
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
        avoidedCount: created.avoidedCount,
        noPhoneCount: created.noPhoneCount,
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

  /**
   * 取り込みを取り消す (request 11/2): a list imported by mistake can be taken back while nobody
   * has worked on it yet. The companies it created go (a company that also came in on another list
   * stays); the file can then be imported again. Refused once any company from it has a call,
   * an appointment or a confirmed allocation, so no work is ever lost.
   */
  async undo(
    actor: Actor,
    id: string,
  ): Promise<{ removedCompanies: number; keptCompanies: number }> {
    const listImport = await this.prisma.listImport.findUnique({
      where: { id },
      include: { rows: { select: { companyId: true } } },
    });
    if (!listImport) {
      throw new NotFoundError();
    }
    const companyIds = [
      ...new Set(listImport.rows.flatMap((row) => (row.companyId ? [row.companyId] : []))),
    ];
    const onOtherLists = new Set(
      (
        await this.prisma.listImportRow.findMany({
          where: { companyId: { in: companyIds }, listImportId: { not: id } },
          select: { companyId: true },
        })
      ).flatMap((row) => (row.companyId ? [row.companyId] : [])),
    );
    const own = companyIds.filter((companyId) => !onOtherLists.has(companyId));
    const [calls, appointments, allocations] = await Promise.all([
      this.prisma.callRecord.count({
        where: { OR: [{ companyId: { in: own } }, { listImportId: id }] },
      }),
      this.prisma.appointment.count({ where: { companyId: { in: own } } }),
      this.prisma.allocation.count({ where: { companyId: { in: own }, status: 'CONFIRMED' } }),
    ]);
    if (calls + appointments + allocations > 0) {
      throw new InvalidStateError({ reason: 'list_in_use', calls, appointments, allocations });
    }
    await this.prisma.$transaction(
      async (tx) => {
        await tx.allocation.deleteMany({ where: { companyId: { in: own } } });
        await tx.company.updateMany({ where: { parentId: { in: own } }, data: { parentId: null } });
        await tx.companyFormerName.deleteMany({ where: { companyId: { in: own } } });
        await tx.listImport.delete({ where: { id } });
        await tx.company.deleteMany({ where: { id: { in: own } } });
      },
      { timeout: 60_000 },
    );
    await this.audit.record({
      action: AuditAction.ListImportUndone,
      actorUserId: actor.id,
      targetType: 'list_import',
      targetId: id,
      before: {
        listName: listImport.listName,
        rowCount: listImport.rowCount,
        createdCount: listImport.createdCount,
        fileId: listImport.fileId,
      },
      after: { removedCompanies: own.length, keptCompanies: companyIds.length - own.length },
    });
    return { removedCompanies: own.length, keptCompanies: companyIds.length - own.length };
  }

  /** The rows of one import as they were read and judged. */
  async rows(listImportId: string, query: ListImportRowsQuery): Promise<ListImportRowDto[]> {
    const exists = await this.prisma.listImport.count({ where: { id: listImportId } });
    if (!exists) {
      throw new NotFoundError();
    }
    const rows = await this.prisma.listImportRow.findMany({
      where: { listImportId, ...(query.status ? { status: query.status } : {}) },
      orderBy: { rowNumber: 'asc' },
      include: { company: { select: { id: true, name: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      rowNumber: row.rowNumber,
      status: row.status,
      errorMessage: row.errorMessage,
      company: row.company,
      rawData: row.rawData as Record<string, string>,
    }));
  }

  private toDto(
    row: Prisma.ListImportGetPayload<{ include: { importedBy: typeof userRefSelect; file: true } }>,
  ): ListImportDto {
    return {
      id: row.id,
      purpose: row.purpose,
      listName: row.listName,
      autoAllocate: row.autoAllocate,
      fileName: row.file.originalName,
      fileId: row.fileId,
      importedBy: userRef(row.importedBy),
      rowCount: row.rowCount,
      createdCount: row.createdCount,
      duplicateCount: row.duplicateCount,
      checkCount: row.checkCount,
      errorCount: row.errorCount,
      avoidedCount: row.avoidedCount,
      noPhoneCount: row.noPhoneCount,
      createdAt: iso(row.createdAt),
    };
  }

  private toCompanyData(
    row: AnalyzedRow,
    input: CommitListImportRequest,
    actorId: string,
    codes: { customerTypes: Map<string, string>; ranks: Map<string, string> },
    callRequest: boolean,
  ): Prisma.CompanyCreateManyInput & { id: string } {
    const address = row.fields.address ?? null;
    const parts = splitJapaneseAddress(address);
    const customerType = row.fields.customerType
      ? (codes.customerTypes.get(row.fields.customerType) ?? null)
      : null;
    const rank = row.fields.companyRank ?? null;
    return {
      id: row.id,
      name: row.name,
      nameKey: row.nameKey,
      office: row.fields.office ?? null,
      department: row.fields.department ?? null,
      phone: row.fields.phone ?? null,
      phoneDigits: row.phoneDigits,
      url: row.fields.url && row.fields.url !== UNKNOWN_URL ? row.fields.url : null,
      sourceUrl: row.fields.sourceUrl?.slice(0, 1000) ?? null,
      postalCode: row.fields.postalCode?.slice(0, 10) ?? null,
      address,
      prefecture: row.fields.prefecture ?? parts.prefecture,
      city: row.fields.city ?? parts.city,
      ...stationOf(row.fields),
      capital: capitalOf(row.fields.capital),
      industry: row.fields.industry ?? null,
      customerType,
      clientNo: row.fields.clientNo ?? null,
      // An unknown rank is kept as written, so nothing in the list is lost.
      companyRank: rank ? (codes.ranks.get(rank) ?? rank.slice(0, 48)) : null,
      parentName: row.fields.parentName?.slice(0, 100) ?? null,
      parentId: input.groupDepartments ? row.departmentOf : null,
      listName: input.listName,
      flag: row.flag,
      flagMatchId: row.matchId,
      // Duplicates stay out of the call targets until a lead resolves them.
      isCallTarget: callRequest && row.flag !== CompanyFlag.Duplicate,
      autoAllocate: input.autoAllocate,
      extra: Object.keys(row.extra).length > 0 ? row.extra : undefined,
      createdById: actorId,
    };
  }

  /** Label (新規) or code (NEW) → code. */
  private async optionCodes(category: OptionCategory): Promise<Map<string, string>> {
    const labels = await this.options.labels(category);
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

  private async analyze(table: Table, corrections: RowFixes): Promise<Analysis> {
    const columns = table.headers.map((header) => ({
      header,
      field: fieldForHeader(header, table.notes[header]),
    }));
    const mapped = new Set(columns.map((column) => column.field).filter(Boolean));
    const missing = REQUIRED_LIST_FIELDS.filter((field) => !mapped.has(field));
    if (missing.length > 0) {
      throw new FileUnreadableError({
        reason: 'missing_columns',
        columns: missing.map((field) => LIST_FIELD_LABEL[field]),
      });
    }
    const corrected = new Map(corrections.map(({ row, ...values }) => [row, values]));
    const rankColumn = columns.find((column) => column.field === 'companyRank');

    const analysis: Analysis = {
      headerRow: table.headerRow,
      headers: table.headers,
      columns,
      valid: [],
      problems: [],
      avoided: [],
      noPhone: [],
      fixes: [],
      fixedCount: 0,
      sAreaCount: 0,
      rowCount: table.rows.length,
    };
    const candidates: AnalyzedRow[] = [];
    for (const { row, values, red } of table.rows) {
      const read: Partial<Record<ListField, string>> = {};
      const extra: Record<string, string> = {};
      const raw: Record<string, string> = {};
      for (const column of columns) {
        const value = values[column.header] ?? '';
        if (!value) continue;
        raw[column.header] = value;
        if (column.field) {
          read[column.field as ListField] = value;
        } else {
          extra[column.header] = value;
        }
      }
      // 住所1 + 住所2 (+ the start of 住所3 when the address ran on): one address (Sano 10/28 ④).
      let addressTail = '';
      if (read.companyRank) {
        const { addressPart, rank } = splitRankCell(read.companyRank);
        addressTail = addressPart;
        read.companyRank = rank;
      }
      const address = [read.address, read.address2, addressTail].filter(Boolean).join(' ');
      if (address) read.address = address;
      delete read.address2;
      Object.assign(read, corrected.get(row));

      const { values: cleaned, fixes } = cleanListRow(read);
      const fields = cleaned as Partial<Record<ListField, string>>;
      if (fixes.length > 0) {
        analysis.fixedCount++;
        analysis.fixes.push(...fixes.map((fix) => ({ row, ...fix })));
      }
      // 「NTT上系」 with NTT in red, or 「上系島津製作所」: rank 上系 and the parent company.
      const parent = rankColumn ? red?.[rankColumn.header] : undefined;
      if (parent && fields.companyRank) {
        fields.companyRank = fields.companyRank.replace(parent, '').trim();
        fields.parentName ??= parent;
      } else if (fields.companyRank) {
        const split = splitCompanyRank(fields.companyRank);
        fields.companyRank = split.rank;
        if (split.parentName) fields.parentName ??= split.parentName;
      }

      if (isUnknownPhone(fields.phone)) {
        analysis.noPhone.push({ row, raw });
        continue;
      }
      const problems = validateListRow(fields);
      const phoneDigits = phoneDigitsOf(fields.phone);
      if (problems.length > 0 || !fields.name || !phoneDigits) {
        analysis.problems.push({
          row,
          raw,
          problems,
          values: {
            name: fields.name ?? '',
            phone: fields.phone ?? '',
            url: fields.url ?? '',
            industry: fields.industry ?? '',
          } satisfies Record<EditableListField, string>,
        });
        continue;
      }
      candidates.push({
        // Generated here so the import rows (and grouped departments) can point at it.
        id: randomUUID(),
        departmentOf: null,
        row,
        raw,
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

    // Numbers on the 回避企業 list never come in (Sano 10/28 ⑥⑦).
    const avoid = new Set(
      (
        await this.prisma.avoidPhone.findMany({
          where: { phoneDigits: { in: candidates.map((row) => row.phoneDigits) } },
          select: { phoneDigits: true },
        })
      ).map((entry) => entry.phoneDigits),
    );
    for (const row of candidates) {
      if (avoid.has(row.phoneDigits)) {
        analysis.avoided.push({
          row: row.row,
          raw: row.raw,
          name: row.name,
          phone: row.fields.phone ?? '',
        });
      } else {
        analysis.valid.push(row);
      }
    }
    analysis.sAreaCount = analysis.valid.filter((row) =>
      isSArea(row.fields.prefecture ?? splitJapaneseAddress(row.fields.address ?? null).prefecture),
    ).length;

    await this.flagDuplicates(analysis.valid);
    return analysis;
  }

  private async flagDuplicates(rows: AnalyzedRow[]): Promise<void> {
    const phones = [...new Set(rows.map((row) => row.phoneDigits))];
    const names = [...new Set(rows.map((row) => row.nameKey))];
    const [byPhone, byName, byFormerName] = await Promise.all([
      this.prisma.company.findMany({
        where: { phoneDigits: { in: phones } },
        select: { id: true, name: true, phoneDigits: true },
        // Match the original company, not an unresolved copy flagged against it.
        orderBy: [{ flag: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.company.findMany({
        where: { nameKey: { in: names } },
        select: {
          id: true,
          name: true,
          nameKey: true,
          office: true,
          department: true,
          parentId: true,
        },
        orderBy: [{ flag: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.companyFormerName.findMany({
        where: { nameKey: { in: names } },
        select: { nameKey: true, company: { select: { id: true, name: true } } },
      }),
    ]);
    const phoneMatch = new Map<string | null, { id: string; name: string }>();
    byPhone.forEach((company) => {
      if (!phoneMatch.has(company.phoneDigits)) phoneMatch.set(company.phoneDigits, company);
    });
    const nameMatch = new Map<
      string,
      {
        id: string;
        name: string;
        office?: string | null;
        department?: string | null;
        parentId?: string | null;
      }
    >();
    byName.forEach((company) => {
      if (!nameMatch.has(company.nameKey)) nameMatch.set(company.nameKey, company);
    });
    byFormerName.forEach((former) => {
      if (!nameMatch.has(former.nameKey)) nameMatch.set(former.nameKey, former.company);
    });

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
          if ('office' in existingByName && isOtherPlace(row.fields, existingByName)) {
            row.departmentOf = existingByName.parentId ?? existingByName.id;
          }
        } else if (sameFileName) {
          row.flag = CompanyFlag.NeedsCheck;
          row.matchedName = `${sameFileName.fields.name}（${sameFileName.row}行目）`;
          if (isOtherPlace(row.fields, sameFileName.fields)) {
            row.departmentOf = sameFileName.departmentOf ?? sameFileName.id;
          }
        }
      }
      seenPhones.set(row.phoneDigits, row);
      seenNames.set(row.nameKey, row);
    }
  }
}

/** 事業所 + 部署, compared without spaces and width differences. */
function placeOf(fields: { office?: string | null; department?: string | null }): string {
  return [fields.office, fields.department]
    .filter(Boolean)
    .join('/')
    .normalize('NFKC')
    .replace(/\s/g, '');
}

/** The row names its own department / office, and it is not the matched company's. */
function isOtherPlace(
  row: { office?: string | null; department?: string | null },
  match: { office?: string | null; department?: string | null },
): boolean {
  const place = placeOf(row);
  return place !== '' && place !== placeOf(match);
}

/** 「中野駅 徒歩5分」 in one column, or the minutes in their own column. */
function stationOf(fields: Partial<Record<ListField, string>>): {
  nearestStation: string | null;
  walkMinutes: number | null;
} {
  const { station, walkMinutes } = splitStation(fields.nearestStation);
  const minutes = fields.walkMinutes ? Number(fields.walkMinutes.replace(/\D/g, '')) : NaN;
  return {
    nearestStation: station?.slice(0, 100) ?? null,
    walkMinutes: Number.isInteger(minutes) && minutes <= 240 ? minutes : walkMinutes,
  };
}

function capitalOf(text: string | undefined): bigint | null {
  const yen = parseCapital(text);
  return yen === null ? null : BigInt(yen);
}
