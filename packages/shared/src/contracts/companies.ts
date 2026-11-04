import { z } from 'zod';
import {
  type CompanyFlag,
  LIST_IMPORT_ROW_STATUSES,
  type ListImportPurpose,
  type ListImportRowStatus,
} from '../enums.js';
import { dateString, optionalText, requiredText, type UserRef } from './common.js';
import type { EditableListField, ListRowFix, ListRowProblem } from './listRows.js';

/** Phone = 10–11 digits once hyphens and spaces are removed (spec §9-1). */
export const PHONE_DIGITS_PATTERN = /^\d{10,11}$/;

export function phoneDigitsOf(phone: string | null | undefined): string | null {
  if (!phone) {
    return null;
  }
  const digits = phone.normalize('NFKC').replace(/\D/g, '');
  return digits || null;
}

export const companyFieldsSchema = z.object({
  name: requiredText(200),
  office: optionalText(100),
  department: optionalText(100),
  phone: optionalText(32),
  url: optionalText(500),
  sourceUrl: optionalText(1000),
  postalCode: optionalText(10),
  address: optionalText(300),
  prefecture: optionalText(10),
  city: optionalText(50),
  nearestStation: optionalText(100),
  /** Minutes on foot from the nearest station. */
  walkMinutes: z.number().int().min(0).max(240).nullish(),
  /** 資本金 in yen. */
  capital: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullish(),
  industry: optionalText(100),
  customerType: optionalText(48),
  clientNo: optionalText(32),
  listingStatus: optionalText(20),
  companyRank: optionalText(48),
  parentName: optionalText(100),
  companyGroupId: z.uuid().nullish(),
});

/** テレマメモ: kept apart from the company fields so telemarketing can write it. */
export const telemaMemoRequestSchema = z.object({ telemaMemo: optionalText(4000) });
export type CompanyFields = z.infer<typeof companyFieldsSchema>;

/** 一括修正 (Sano 11/2): every company field can be changed at once; it can be undone. */
export const BULK_EDIT_FIELDS = [
  'name',
  'office',
  'department',
  'phone',
  'url',
  'sourceUrl',
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
  'companyRank',
  'parentName',
] as const;
export type BulkEditField = (typeof BULK_EDIT_FIELDS)[number];

export const bulkEditRequestSchema = z.object({
  companyIds: z.array(z.uuid()).min(1).max(200),
  /** Only the fields present are written; null empties a field (not 会社名). */
  changes: companyFieldsSchema
    .omit({ companyGroupId: true, listingStatus: true })
    .partial()
    .refine((changes) => Object.keys(changes).length > 0)
    .refine((changes) => !('name' in changes) || !!changes.name),
});
export type BulkEditRequest = z.infer<typeof bulkEditRequestSchema>;

export interface BulkEditDto {
  id: string;
  actor: UserRef | null;
  changes: BulkEditRequest['changes'];
  companyCount: number;
  companies: { id: string; name: string }[];
  createdAt: string;
  restoredAt: string | null;
  restoredBy: UserRef | null;
  skippedCount: number;
}

export const updateCompanyRequestSchema = companyFieldsSchema.extend({
  /** The updatedAt the editor started from; a newer value means someone else saved first. */
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
});
export type UpdateCompanyRequest = z.infer<typeof updateCompanyRequestSchema>;

export const resolveFlagRequestSchema = z.object({
  /**
   * KEEP = a separate company (callable).
   * MERGE = the same company as the match: its import history and records move to the match.
   * EXCLUDE = the same company, but there is no registered match to merge into (not called).
   * DEPARTMENT = another department / office of the match's company: kept, grouped under it.
   */
  action: z.enum(['KEEP', 'MERGE', 'EXCLUDE', 'DEPARTMENT']),
});
export type ResolveFlagRequest = z.infer<typeof resolveFlagRequestSchema>;

/** One condition of the call-target filter (spec §6: AND / OR). */
export const companyFilterConditionSchema = z.object({
  field: z.enum([
    'name',
    'prefecture',
    'city',
    'industry',
    'listName',
    'customerType',
    'lastGrade',
    'nextCallDue',
    'neverCalled',
    'flag',
    'companyRank',
    /** Telemarketer of the latest call (user id). */
    'telemarketer',
    /** Ranges are written 「from~to」; either side may be empty. */
    'telemaIdNo',
    /** 最新テレマ日: day of the latest call. */
    'lastCallDate',
    /** 取込日: day the company came in on any list. */
    'importedDate',
    /** テレマ予定日: B次回架電日 of the latest call. */
    'nextCallDate',
    'office',
    'department',
    'postalCode',
    'address',
    'nearestStation',
    'phone',
    /** 備考: テレマメモ and the notes and details of its calls. */
    'remarks',
    /** 営業担当者: the rep of one of its appointments. */
    'salesRep',
    /** 訪問確認日: day of an appointment that was not cancelled. */
    'visitDate',
    /** 資本金 in yen, 「from~to」. */
    'capital',
    /** 本社: the office is 本社. */
    'headOffice',
    'visitCancelled',
  ]),
  value: z.string().max(200).default(''),
  /** Several picks: a company matches any of them. BLANK_VALUE picks 「空白」. */
  values: z.array(z.string().max(200)).max(200).default([]),
});

/** The 「空白」 pick of a multi-select condition: nothing is entered for the field. */
export const BLANK_VALUE = '__blank__';

/** 「from~to」 of a range condition; either side may be empty. */
export function splitRange(value: string): { from: string; to: string } {
  const [from = '', to = ''] = value.split('~').map((part) => part.trim());
  return { from, to };
}
export type CompanyFilterCondition = z.infer<typeof companyFilterConditionSchema>;

export const companySearchRequestSchema = z.object({
  /** Words searched across every company field; all words must match (request 10/30). */
  keyword: z.string().max(200).default(''),
  conditions: z.array(companyFilterConditionSchema).max(30).default([]),
  match: z.enum(['AND', 'OR']).default('AND'),
  callTargetsOnly: z.boolean().default(true),
  /** 架電対象外: companies registered for later (request 11/2). */
  nonTargetsOnly: z.boolean().default(false),
  /** Only companies allocated to me today (confirmed allocation). */
  assignedToMe: z.boolean().default(false),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});
export type CompanySearchRequest = z.infer<typeof companySearchRequestSchema>;

export interface CompanyListItem {
  id: string;
  name: string;
  office: string | null;
  phone: string | null;
  prefecture: string | null;
  city: string | null;
  industry: string | null;
  companyRank: string | null;
  capital: number | null;
  customerType: string | null;
  listName: string | null;
  flag: CompanyFlag;
  isCallTarget: boolean;
  lastCall: {
    calledAt: string;
    grade: string;
    telemarketer: UserRef;
    /** C架電回避目安: shown as 「○年○月○日までは架電回避」; nothing happens by itself when it ends. */
    avoidUntil: string | null;
  } | null;
  nextCallDate: string | null;
}

export interface CompanyDetail extends CompanyListItem {
  department: string | null;
  walkMinutes: number | null;
  postalCode: string | null;
  url: string | null;
  /** 掲載元のURL: where the list maker found the company (the list's 「引用先URL」). */
  sourceUrl: string | null;
  address: string | null;
  nearestStation: string | null;
  clientNo: string | null;
  telemaIdNo: string | null;
  listingStatus: string | null;
  parentName: string | null;
  telemaMemo: string | null;
  companyGroupId: string | null;
  extra: Record<string, string> | null;
  formerNames: string[];
  /** On the 回避企業 list (by phone): who put it there and when. */
  avoided: { by: UserRef | null; at: string; source: 'LIST' | 'CALL' } | null;
  /** Same name, phone differs only in the last 1–2 digits (warning only, spec §7). */
  similarNumbers: { id: string; name: string; phone: string | null }[];
  /** The same company's other departments / offices (grouped, request 11/2). */
  groupMembers: CompanyRefWithDepartment[];
  /** Same name, not grouped yet: offered to group as departments. */
  sameNameCompanies: CompanyRefWithDepartment[];
  /** Companies this one was flagged against on import. */
  flagMatches: { id: string; name: string; phone: string | null }[];
  /** Every list this company came in on, newest first. */
  imports: CompanyImportDto[];
  updatedAt: string;
}

export interface CompanyRefWithDepartment {
  id: string;
  name: string;
  office: string | null;
  department: string | null;
  phone: string | null;
  /** The company the group is kept under. */
  isGroupRoot: boolean;
}

/** Move companies into or out of the call targets (架電対象 / 架電対象外). */
export const setCallTargetRequestSchema = z.object({
  companyIds: z.array(z.uuid()).min(1).max(200),
  isCallTarget: z.boolean(),
});
export type SetCallTargetRequest = z.infer<typeof setCallTargetRequestSchema>;

export interface SetCallTargetResult {
  changed: number;
  /** Not moved in: on the 回避企業 list or an unresolved duplicate. */
  skipped: number;
}

/** Group same-name companies as departments / offices of one company. */
export const groupDepartmentsRequestSchema = z.object({
  companyIds: z.array(z.uuid()).min(1).max(50),
});
export type GroupDepartmentsRequest = z.infer<typeof groupDepartmentsRequestSchema>;

export interface CompanyImportDto {
  listImportId: string;
  listName: string;
  purpose: ListImportPurpose;
  rowNumber: number;
  status: ListImportRowStatus;
  importedAt: string;
}

export const createCallRecordRequestSchema = z.object({
  grade: requiredText(48),
  /** Option code in "call_result" under the chosen grade. */
  resultCode: optionalText(48),
  resultDetail: optionalText(2000),
  contactName: optionalText(100),
  interestLevel: optionalText(48),
  nextCallDate: dateString.nullish(),
  avoidMonths: z
    .union([z.literal(3), z.literal(6), z.literal(12), z.literal(18), z.literal(24)])
    .nullish(),
  notes: optionalText(4000),
});
export type CreateCallRecordRequest = z.infer<typeof createCallRecordRequestSchema>;

export interface CallRecordDto {
  id: string;
  companyId: string;
  telemarketer: UserRef;
  calledAt: string;
  grade: string;
  resultCode: string | null;
  resultDetail: string | null;
  contactName: string | null;
  interestLevel: string | null;
  nextCallDate: string | null;
  avoidMonths: number | null;
  /** 架電回避 until this day (called date + avoidMonths). The company does not come back by itself. */
  avoidUntil: string | null;
  notes: string | null;
  commentCount: number;
  canEdit: boolean;
}

export interface ListImportRowIssue {
  row: number;
  message: string;
}

/** A row that cannot be imported as it is: shown so it can be corrected on screen. */
export interface ListImportProblemRow {
  row: number;
  /** The editable values after the automatic fixes. */
  values: Record<EditableListField, string>;
  problems: ListRowProblem[];
  /** The row as read, by header, for the CSV of rows left out. */
  raw: Record<string, string>;
}

export interface ListImportPreview {
  fileId: string;
  fileName: string;
  /** Excel row the headers were found on (1 or 2: the Telema template has a note above). */
  headerRow: number;
  rowCount: number;
  validCount: number;
  duplicateCount: number;
  checkCount: number;
  /** Rows on the 回避企業 list: left out. */
  avoided: { row: number; name: string; phone: string }[];
  /** Rows with a blank or 「不明」 phone: left out. */
  noPhoneCount: number;
  /** Rows changed by the automatic fixes, and a few examples. */
  fixedCount: number;
  fixSamples: ({ row: number } & ListRowFix)[];
  /** Companies in Kyoto, Shiga or Nara (the 「s」 label). */
  sAreaCount: number;
  /** Same name as another company but another department / office: can be grouped. */
  departmentCount: number;
  problems: ListImportProblemRow[];
  /** Headers of the file in order, for the CSV of rows left out. */
  headers: string[];
  /** Header names found in the file and the field each one maps to (null = kept as extra). */
  columns: { header: string; field: string | null }[];
  sample: {
    row: number;
    name: string;
    phone: string;
    url: string;
    flag: CompanyFlag;
    matchedName: string | null;
  }[];
}

export const commitListImportRequestSchema = z.object({
  fileId: z.uuid(),
  purpose: z.enum(['CALL_REQUEST', 'REGISTER_ONLY']),
  /** Saved as 「YYYYMMDD_リスト名」 (the import date is added in front). */
  listName: requiredText(180),
  /** 「自動割り振りする」: the companies go into the morning automatic allocation. */
  autoAllocate: z.boolean().default(true),
  /** Same name, another department / office: grouped under that company, not 要確認 (11/2). */
  groupDepartments: z.boolean().default(true),
  /** Corrections made on the import screen, by Excel row. */
  fixes: z
    .array(
      z.object({
        row: z.number().int().min(1),
        name: z.string().max(200).optional(),
        phone: z.string().max(32).optional(),
        url: z.string().max(500).optional(),
        industry: z.string().max(100).optional(),
      }),
    )
    .max(5000)
    .default([]),
});

/** 「20261030_」: the import date put in front of every list name (request 10/29). */
export function datedListName(listName: string, importDate: string): string {
  const prefix = `${importDate.replaceAll('-', '')}_`;
  const name = listName.trim();
  return name.startsWith(prefix) ? name : `${prefix}${name}`;
}
export type CommitListImportRequest = z.infer<typeof commitListImportRequestSchema>;

export interface ListImportDto {
  id: string;
  purpose: ListImportPurpose;
  listName: string;
  autoAllocate: boolean;
  fileName: string;
  fileId: string;
  importedBy: UserRef;
  rowCount: number;
  createdCount: number;
  duplicateCount: number;
  checkCount: number;
  errorCount: number;
  avoidedCount: number;
  noPhoneCount: number;
  createdAt: string;
}

export const listImportRowsQuerySchema = z.object({
  status: z.enum(LIST_IMPORT_ROW_STATUSES).optional(),
});
export type ListImportRowsQuery = z.infer<typeof listImportRowsQuerySchema>;

/** One row of an imported file as it was read and judged. */
export interface ListImportRowDto {
  id: string;
  rowNumber: number;
  status: ListImportRowStatus;
  errorMessage: string | null;
  company: { id: string; name: string } | null;
  rawData: Record<string, string>;
}

/** Rep suggestion from the sales area table (spec §7). */
export const findRepRequestSchema = z.object({
  companyId: z.uuid().optional(),
  prefecture: z.string().trim().max(10).optional(),
  city: z.string().trim().max(50).optional(),
  customerType: z.string().trim().max(48).optional(),
  companyGroupId: z.uuid().optional(),
  /** For a company not saved yet: its group is looked up by name. */
  companyName: z.string().trim().max(200).optional(),
});
export type FindRepRequest = z.infer<typeof findRepRequestSchema>;

export interface RepSuggestion {
  rep: UserRef | null;
  backup: UserRef | null;
  webOnly: boolean;
  ruleId: string | null;
  /** Human-readable reason, e.g. 「大阪府 大阪市 ／ 現取以外」. */
  matchedBy: string | null;
}
