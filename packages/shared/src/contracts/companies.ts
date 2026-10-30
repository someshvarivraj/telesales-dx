import { z } from 'zod';
import {
  type CompanyFlag,
  LIST_IMPORT_ROW_STATUSES,
  type ListImportPurpose,
  type ListImportRowStatus,
} from '../enums.js';
import { dateString, optionalText, requiredText, type UserRef } from './common.js';

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
  address: optionalText(300),
  prefecture: optionalText(10),
  city: optionalText(50),
  nearestStation: optionalText(100),
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
   */
  action: z.enum(['KEEP', 'MERGE', 'EXCLUDE']),
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
  ]),
  value: z.string().max(200).default(''),
});

/** 「from~to」 of a range condition; either side may be empty. */
export function splitRange(value: string): { from: string; to: string } {
  const [from = '', to = ''] = value.split('~').map((part) => part.trim());
  return { from, to };
}
export type CompanyFilterCondition = z.infer<typeof companyFilterConditionSchema>;

export const companySearchRequestSchema = z.object({
  /** Words searched across every company field; all words must match (request 10/30). */
  keyword: z.string().max(200).default(''),
  conditions: z.array(companyFilterConditionSchema).max(10).default([]),
  match: z.enum(['AND', 'OR']).default('AND'),
  callTargetsOnly: z.boolean().default(true),
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
  customerType: string | null;
  listName: string | null;
  flag: CompanyFlag;
  isCallTarget: boolean;
  lastCall: { calledAt: string; grade: string; telemarketer: UserRef } | null;
  nextCallDate: string | null;
}

export interface CompanyDetail extends CompanyListItem {
  department: string | null;
  url: string | null;
  address: string | null;
  nearestStation: string | null;
  clientNo: string | null;
  telemaIdNo: string | null;
  listingStatus: string | null;
  companyRank: string | null;
  parentName: string | null;
  telemaMemo: string | null;
  companyGroupId: string | null;
  extra: Record<string, string> | null;
  formerNames: string[];
  /** Same name, phone differs only in the last 1–2 digits (warning only, spec §7). */
  similarNumbers: { id: string; name: string; phone: string | null }[];
  /** Companies this one was flagged against on import. */
  flagMatches: { id: string; name: string; phone: string | null }[];
  /** Every list this company came in on, newest first. */
  imports: CompanyImportDto[];
  updatedAt: string;
}

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
  /** Called again from this day (called date + avoidMonths). */
  avoidUntil: string | null;
  notes: string | null;
  commentCount: number;
  canEdit: boolean;
}

export interface ListImportRowIssue {
  row: number;
  message: string;
}

export interface ListImportPreview {
  fileId: string;
  fileName: string;
  rowCount: number;
  validCount: number;
  duplicateCount: number;
  checkCount: number;
  errors: ListImportRowIssue[];
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
