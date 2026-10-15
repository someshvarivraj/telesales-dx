export const AuditAction = {
  LoginSucceeded: 'auth.login.succeeded',
  LoginFailed: 'auth.login.failed',
  AccountLocked: 'auth.account.locked',
  Logout: 'auth.logout',
  PasswordChanged: 'auth.password.changed',
  UserCreated: 'user.created',
  UserUpdated: 'user.updated',
  RolesChanged: 'user.roles.changed',
  PasswordReset: 'user.password.reset',
  CompanyCreated: 'company.created',
  CompanyUpdated: 'company.updated',
  CompanyFlagResolved: 'company.flag.resolved',
  CompanyMerged: 'company.merged',
  ListImported: 'list.imported',
  CallRecordCreated: 'call_record.created',
  CallRecordUpdated: 'call_record.updated',
  AppointmentCreated: 'appointment.created',
  AppointmentUpdated: 'appointment.updated',
  AppointmentRescheduled: 'appointment.rescheduled',
  AppointmentCancelled: 'appointment.cancelled',
  AppointmentConfirmed: 'appointment.confirmed',
  DayBeforeChecked: 'appointment.day_before.checked',
  MeetingResultAdded: 'appointment.result.added',
  PreparationAdded: 'appointment.preparation.added',
  ChangeRequestUpdated: 'change_request.updated',
  EmailSent: 'email.sent',
  PlanCreated: 'plan.created',
  PlanUpdated: 'plan.updated',
  PlanDeleted: 'plan.deleted',
  TimeOffCreated: 'time_off.created',
  TimeOffDeleted: 'time_off.deleted',
  LockReleased: 'slot_lock.released',
  SettingsChanged: 'settings.changed',
  TelemarketerUpdated: 'telemarketer.updated',
  ShiftSaved: 'shift.saved',
  ShiftDeleted: 'shift.deleted',
  ShiftsFilled: 'shift.filled',
  AllocationCalculated: 'allocation.calculated',
  AllocationMoved: 'allocation.moved',
  AllocationConfirmed: 'allocation.confirmed',
  NextActionUpdated: 'appointment.next_action.updated',
  AppCreated: 'app.created',
  AppUpdated: 'app.updated',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

/** Who did it and from where. Populated from the HTTP request. */
export interface RequestContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface AuditEntry {
  action: AuditAction;
  actorUserId?: string | null;
  targetType?: string;
  targetId?: string;
  /** State before and after the change (spec §2-9: who changed what, when, before/after). */
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  context?: RequestContext;
}

export interface AuditLogger {
  record(entry: AuditEntry): Promise<void>;
}
