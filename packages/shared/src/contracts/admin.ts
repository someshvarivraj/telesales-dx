import { z } from 'zod';
import type { HolidayKind, RecipientField, RecipientKind } from '../enums.js';
import { ALL_PERMISSIONS, type Permission } from '../permissions.js';
import { ALL_ROLES, type Role } from '../roles.js';
import { dateString, optionalText, requiredText, timeString, type UserRef } from './common.js';

export type UserStatusValue = 'ACTIVE' | 'DISABLED';

const roleEnum = z.enum(ALL_ROLES as [Role, ...Role[]]);
const permissionEnum = z.enum(ALL_PERMISSIONS as [Permission, ...Permission[]]);

export const createUserRequestSchema = z.object({
  employeeNo: optionalText(32),
  name: requiredText(100),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  roles: z.array(roleEnum).min(1),
});
export type CreateUserRequest = z.input<typeof createUserRequestSchema>;

export const updateUserRequestSchema = createUserRequestSchema.extend({
  status: z.enum(['ACTIVE', 'DISABLED']),
  grants: z.array(permissionEnum).default([]),
  telemarketer: z
    .object({
      isAllocationTarget: z.boolean(),
      territory: z.array(z.string().trim().min(1).max(10)).max(47),
    })
    .nullish(),
});
export type UpdateUserRequest = z.input<typeof updateUserRequestSchema>;

export interface AdminUserDto {
  id: string;
  employeeNo: string | null;
  name: string;
  email: string;
  status: UserStatusValue;
  roles: Role[];
  grants: Permission[];
  lastLoginAt: string | null;
  isLocked: boolean;
  mustChangePassword: boolean;
  telemarketer: { isAllocationTarget: boolean; territory: string[] } | null;
}

export interface TemporaryPasswordResponse {
  user: AdminUserDto;
  /** Shown once. */
  temporaryPassword: string;
}

export const optionRequestSchema = z.object({
  category: requiredText(48),
  code: z
    .string()
    .trim()
    .min(1)
    .max(48)
    .regex(/^[A-Z0-9_]+$/),
  label: requiredText(100),
});
export const updateOptionRequestSchema = z.object({
  label: requiredText(100),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
});

export const companyHolidayRequestSchema = z.object({
  date: dateString,
  name: requiredText(100),
});
export const calendarYearQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

export interface CalendarDayAdminDto {
  date: string;
  name: string;
  kind: HolidayKind;
}

export interface NoticeSettingDto {
  code: string;
  name: string;
  isEnabled: boolean;
  sendsEmail: boolean;
  sendTime: string | null;
  daysBefore: number[];
  recipients: NoticeRecipientDto[];
}

export interface NoticeRecipientDto {
  id: string;
  field: RecipientField;
  kind: RecipientKind;
  value: string;
  /** Display label: user name, role name, address or context label. */
  label: string;
}

export const updateNoticeRequestSchema = z.object({
  isEnabled: z.boolean(),
  sendsEmail: z.boolean(),
  sendTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullish(),
  daysBefore: z.array(z.number().int().min(0).max(30)).max(5).default([]),
});

export const noticeRecipientRequestSchema = z.object({
  field: z.enum(['TO', 'CC']),
  kind: z.enum(['EMAIL', 'USER', 'ROLE', 'CONTEXT']),
  value: requiredText(254),
});

export const areaRuleRequestSchema = z.object({
  prefecture: requiredText(10),
  city: optionalText(50),
  /** null = any; 'CURRENT' = current clients only; 'NOT_CURRENT' = everyone else. */
  customerTypeCondition: z.enum(['CURRENT', 'NOT_CURRENT']).nullish(),
  companyGroupId: z.uuid().nullish(),
  salesRepId: z.uuid(),
  backupRepId: z.uuid().nullish(),
  webOnly: z.boolean().default(false),
  validFrom: dateString,
  validTo: dateString.nullish(),
});
export type AreaRuleRequest = z.input<typeof areaRuleRequestSchema>;

export interface AreaRuleDto {
  id: string;
  prefecture: string;
  city: string | null;
  customerTypeCondition: 'CURRENT' | 'NOT_CURRENT' | null;
  companyGroup: { id: string; name: string } | null;
  salesRep: UserRef;
  backupRep: UserRef | null;
  webOnly: boolean;
  validFrom: string;
  validTo: string | null;
}

export const companyGroupRequestSchema = z.object({
  name: requiredText(100),
  isActive: z.boolean().default(true),
  /** Company names in the group, matched on the normalised name. Omitted = keep as is. */
  members: z.array(requiredText(200)).max(1000).optional(),
});
export type CompanyGroupRequest = z.input<typeof companyGroupRequestSchema>;

export interface CompanyGroupDto {
  id: string;
  name: string;
  isActive: boolean;
  /** Company names that belong to the group, in the order entered. */
  members: string[];
}

/** Recent operation history (Q-09): who, when, what, and what changed. */
export const auditLogQuerySchema = z.object({
  /** e.g. appointment, plan, company, user; empty = everything. */
  targetType: z.string().trim().max(64).optional(),
  actorId: z.uuid().optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});
export type AuditLogQuery = z.input<typeof auditLogQuerySchema>;

/** One changed field; values are already turned into short display text. */
export interface AuditChangeDto {
  field: string;
  before: string | null;
  after: string | null;
}

export interface AuditLogDto {
  id: string;
  createdAt: string;
  actor: UserRef | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  changes: AuditChangeDto[];
}

export interface AuditLogResponse {
  items: AuditLogDto[];
  /** True when more entries matched than are shown (older ones: ask an admin). */
  truncated: boolean;
  /** Days of history the screen covers. */
  days: number;
}

export interface AppSettingsDto {
  travelBufferMinutes: number;
  travelBufferMode: 'WARN' | 'BLOCK';
  /** JST time of the morning allocation run on business days. */
  allocationRunTime: string;
  /** N13: remind telemarketing when nobody has taken a change request for this long. */
  changeRequestReminderMinutes: number;
}

export const appSettingsRequestSchema = z.object({
  travelBufferMinutes: z.number().int().min(0).max(240),
  travelBufferMode: z.enum(['WARN', 'BLOCK']),
  allocationRunTime: timeString,
  changeRequestReminderMinutes: z
    .number()
    .int()
    .min(15)
    .max(24 * 60),
});

/** Apps sharing the company-wide accounts (spec §6 app management). */
export interface AppDto {
  key: string;
  name: string;
  /** While on, only admins can use the app. */
  maintenanceMode: boolean;
  /** This app (the one serving the request). */
  current: boolean;
}

export const createAppRequestSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_-]{1,31}$/),
  name: requiredText(100),
});
export type CreateAppRequest = z.input<typeof createAppRequestSchema>;

export const updateAppRequestSchema = z.object({
  name: requiredText(100),
  maintenanceMode: z.boolean(),
});
export type UpdateAppRequest = z.input<typeof updateAppRequestSchema>;

export interface SystemStatusResponse {
  maintenance: boolean;
}
