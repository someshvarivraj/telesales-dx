import { Role } from './roles.js';

/**
 * What a user may do (spec v1 §4 permission table).
 * Row-level rules ("own records", "assigned or attending") are enforced by the
 * services on top of these permissions.
 */
export const Permission = {
  /** View appointments, call records, meeting results, dashboard, schedules. */
  ViewData: 'data.view',
  /** Ask questions / comment on appointments, call records, meeting results. */
  WriteComments: 'comments.write',
  ImportLists: 'lists.import',
  ResolveDuplicates: 'companies.resolve_duplicates',
  /** Telemarketers: own records only. Leads and admins: all. */
  WriteCallRecords: 'call_records.write',
  EditCompanies: 'companies.edit',
  /** Book, reschedule, cancel appointments booked by telemarketing. */
  ManageTelemaAppointments: 'appointments.telema.manage',
  /** Register and change appointments sales booked themselves. */
  ManageSalesAppointments: 'appointments.sales.manage',
  /** Confirm, meeting link, preparation, meeting result, next action (assigned or attending). */
  WorkOnAppointments: 'appointments.sales_work',
  SendChangeRequests: 'change_requests.send',
  HandleChangeRequests: 'change_requests.handle',
  WriteDayBeforeChecks: 'day_before_checks.write',
  /** Sales plans other than appointments, and time off — own and other reps. */
  WriteSalesPlans: 'sales_plans.write',
  /** Telemarketers: own shift and absences they were told about. */
  WriteShifts: 'shifts.write',
  ConfirmAllocation: 'allocation.confirm',
  EditAreaTable: 'area_table.edit',
  /** Users, roles, option lists, holiday calendar, notice recipients, lock release. */
  Administer: 'admin.manage',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(Permission);

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && (ALL_PERMISSIONS as readonly string[]).includes(value);
}

const everyone: Permission[] = [Permission.ViewData, Permission.WriteComments];

const telema: Permission[] = [
  ...everyone,
  Permission.WriteCallRecords,
  Permission.EditCompanies,
  // Q-03 (10/20): telemarketers also decide what to do with duplicates.
  Permission.ResolveDuplicates,
  Permission.ManageTelemaAppointments,
  Permission.HandleChangeRequests,
  Permission.WriteDayBeforeChecks,
  Permission.WriteShifts,
];

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  [Role.Telema]: telema,
  // A lead is a telemarketer with extra permissions.
  [Role.TelemaLead]: [...telema, Permission.ImportLists, Permission.ConfirmAllocation],
  [Role.Sales]: [
    ...everyone,
    // Q-02 (10/20): sales do not import new lists (an admin can still grant it).
    Permission.EditCompanies,
    Permission.ManageSalesAppointments,
    Permission.WorkOnAppointments,
    Permission.SendChangeRequests,
    Permission.WriteSalesPlans,
  ],
  [Role.Viewer]: everyone,
  [Role.Admin]: ALL_PERMISSIONS,
};

/**
 * Effective permissions = union of the roles' permissions plus individual grants
 * (e.g. the person entrusted with the area table, or telemarketers allowed to import).
 */
export function resolvePermissions(
  roles: readonly Role[],
  grants: readonly Permission[] = [],
): Permission[] {
  const result = new Set<Permission>(grants);
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role]) {
      result.add(permission);
    }
  }
  return ALL_PERMISSIONS.filter((permission) => result.has(permission));
}
