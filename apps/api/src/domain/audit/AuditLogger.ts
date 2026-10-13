export const AuditAction = {
  LoginSucceeded: 'auth.login.succeeded',
  LoginFailed: 'auth.login.failed',
  AccountLocked: 'auth.account.locked',
  Logout: 'auth.logout',
  PasswordChanged: 'auth.password.changed',
  UserCreated: 'user.created',
  UserUpdated: 'user.updated',
  RolesChanged: 'user.roles.changed',
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
