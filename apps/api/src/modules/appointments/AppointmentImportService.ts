import {
  APP_KEY,
  type AppointmentFilePrefill,
  fromJst,
  MeetingFormat,
  phoneDigitsOf,
  Role,
  type UserRef,
} from '@telesales/shared';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import { splitJapaneseAddress, splitListingSuffix } from '../../domain/area/japaneseAddress.js';
import { normalizeCompanyName } from '../../domain/companies/duplicates.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { FileUnreadableError, ValidationError } from '../../http/errors/AppError.js';
import { userRef } from '../../http/mappers.js';
import type { FileService, StoredFileRecord, UploadedFile } from '../files/FileService.js';
import { sourceHashOf } from './AppointmentBookingService.js';
import {
  HandoverFileError,
  type HandoverPdfFields,
  parseHandoverPdf,
  parseSlashDateTime,
  parseTelemaCsv,
  suggestsOnline,
  type TelemaCsvRow,
} from './HandoverFileParsers.js';

function personKey(name: string): string {
  return name.normalize('NFKC').replace(/[\s　]/g, '');
}

function isPdf(file: UploadedFile): boolean {
  return file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
}

/**
 * Existing-list appointments (spec §9-2): read the telemarketing CSV and/or the handover
 * PDF, and return what was read so the telemarketer can check and complete it before saving.
 * Unreadable files fall back to manual entry.
 */
export class AppointmentImportService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly files: FileService,
  ) {}

  async prefill(
    actor: Actor,
    uploads: UploadedFile[],
    csvRowIndex: number | null,
  ): Promise<AppointmentFilePrefill> {
    if (uploads.length === 0 || uploads.length > 2) {
      throw new ValidationError({ files: ['one_or_two_files'] });
    }
    const pdfUpload = uploads.find(isPdf);
    const csvUpload = uploads.find((file) => !isPdf(file));
    const warnings: string[] = [];

    let csvRows: TelemaCsvRow[] = [];
    let pdf: HandoverPdfFields | null = null;
    try {
      if (csvUpload) {
        csvRows = parseTelemaCsv(csvUpload.buffer);
        if (csvRows.length === 0) {
          throw new HandoverFileError('empty');
        }
      }
      if (pdfUpload) {
        pdf = await parseHandoverPdf(pdfUpload.buffer);
        if (pdf.pageCount > 1) {
          warnings.push(`PDFは${pdf.pageCount}ページあります。1ページ目だけを読み込みました。`);
        }
      }
    } catch (error) {
      if (error instanceof HandoverFileError) {
        throw new FileUnreadableError({ reason: error.reason });
      }
      throw error;
    }

    const index = csvRows.length > 1 ? csvRowIndex : 0;
    const csv = index !== null && index !== undefined ? (csvRows[index] ?? null) : null;
    if (csvRows.length > 1 && csvRowIndex !== null && !csv) {
      throw new ValidationError({ rowIndex: ['out_of_range'] });
    }

    const stored: StoredFileRecord[] = [];
    for (const upload of [csvUpload, pdfUpload]) {
      if (upload) {
        stored.push(await this.files.store(upload, actor.id));
      }
    }

    const address = pdf?.address || csv?.address || '';
    const { address: cleanAddress, listingStatus } = splitListingSuffix(address);
    const parts = splitJapaneseAddress(cleanAddress);
    const name = csv?.name || pdf?.company || null;
    const phone = csv?.phone || pdf?.phone || null;

    const bookedByName = csv?.telemarketer || pdf?.telemarketer || null;
    const salesRepName = pdf?.salesRep || null;
    const [bookedBy, salesRep] = await Promise.all([
      this.matchUser(bookedByName, null),
      this.matchUser(salesRepName, Role.Sales),
    ]);
    if (bookedByName && !bookedBy) {
      warnings.push(
        `テレマ担当者「${bookedByName}」がユーザーに見つかりません。アポ取得者を選んでください。`,
      );
    }
    if (salesRepName && !salesRep) {
      warnings.push(`営業担当「${salesRepName}」がユーザーに見つかりません。`);
    }

    const visit = pdf?.visitDateTime ? parseSlashDateTime(pdf.visitDateTime) : null;
    const booked = parseSlashDateTime(csv?.latestCallDate || pdf?.callDate || '');
    const notes = [
      pdf?.desiredJobType ? `【希望職種】${pdf.desiredJobType}` : null,
      pdf?.notes || null,
    ]
      .filter(Boolean)
      .join('\n');

    const matchedCompany = name
      ? await this.prisma.company.findFirst({
          where: {
            nameKey: normalizeCompanyName(name),
            ...(phoneDigitsOf(phone) ? { phoneDigits: phoneDigitsOf(phone) } : {}),
          },
          select: { id: true },
        })
      : null;

    const rowKey = csvRows.length > 1 && index !== null ? `row:${index}` : null;
    const hash = sourceHashOf(
      stored.map((file) => file.sha256),
      rowKey,
    );
    const already = hash
      ? await this.prisma.appointment.findUnique({
          where: { sourceFingerprint: hash },
          select: { id: true },
        })
      : null;

    return {
      fileIds: stored.map((file) => file.id),
      sourceRowKey: rowKey,
      alreadyImportedAppointmentId: already?.id ?? null,
      company: {
        name,
        office: csv?.office || null,
        department: csv?.department || pdf?.department || null,
        phone,
        address: cleanAddress || null,
        prefecture: parts.prefecture,
        city: parts.city,
        nearestStation: csv?.nearestStation || pdf?.nearestStation || null,
        industry: csv?.industry || null,
        clientNo: pdf?.clientNo || null,
        telemaIdNo: csv?.telemaIdNo || null,
        listingStatus,
      },
      matchedCompanyId: matchedCompany?.id ?? null,
      listName: csv?.listName || null,
      bookedBy,
      bookedByName,
      bookedOn: booked?.date ?? null,
      salesRep,
      salesRepName,
      startsAt: visit?.time ? fromJst(visit.date, visit.time).toISOString() : null,
      contactName: pdf?.contact || null,
      contactPhone: null,
      handoverNotes: notes || null,
      suggestedFormat: notes && suggestsOnline(notes) ? MeetingFormat.Online : null,
      csvRows:
        csvRows.length > 1
          ? csvRows.map((row, rowIndex) => ({
              index: rowIndex,
              name: row.name,
              listName: row.listName || null,
              calledOn: parseSlashDateTime(row.latestCallDate)?.date ?? null,
            }))
          : [],
      warnings,
    };
  }

  /** Reps and telemarketers are matched by name, ignoring spaces (spec §9-2). */
  private async matchUser(name: string | null, role: Role | null): Promise<UserRef | null> {
    if (!name) {
      return null;
    }
    const key = personKey(name);
    const candidates = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        ...(role ? { roles: { some: { appKey: APP_KEY, role } } } : {}),
      },
      select: { id: true, name: true },
    });
    const matches = candidates.filter((candidate) => personKey(candidate.name) === key);
    const [only, ...others] = matches;
    return only && others.length === 0 ? userRef(only) : null;
  }
}
