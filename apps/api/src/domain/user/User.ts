import {
  type Permission,
  type Role,
  resolvePermissions,
  type SessionUser,
  sortRoles,
} from '@telesales/shared';

export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface UserProps {
  id: string;
  employeeNo: string | null;
  name: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  mustChangePassword: boolean;
  failedLoginCount: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  passwordChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Roles in this app (several per user). */
  roles: Role[];
  /** Individual permission grants in this app, kept as data. */
  grants: Permission[];
}

/**
 * User aggregate. Holds the login and permission rules so services and
 * repositories stay free of policy decisions.
 */
export class User {
  private readonly permissionSet: ReadonlySet<Permission>;

  private constructor(private props: UserProps) {
    this.permissionSet = new Set(resolvePermissions(props.roles, props.grants));
  }

  static restore(props: UserProps): User {
    return new User({ ...props, roles: [...props.roles], grants: [...props.grants] });
  }

  get id(): string {
    return this.props.id;
  }
  get employeeNo(): string | null {
    return this.props.employeeNo;
  }
  get name(): string {
    return this.props.name;
  }
  get email(): string {
    return this.props.email;
  }
  get passwordHash(): string {
    return this.props.passwordHash;
  }
  get isActive(): boolean {
    return this.props.status === 'ACTIVE';
  }
  get mustChangePassword(): boolean {
    return this.props.mustChangePassword;
  }
  get failedLoginCount(): number {
    return this.props.failedLoginCount;
  }
  get lastLoginAt(): Date | null {
    return this.props.lastLoginAt;
  }
  get roles(): readonly Role[] {
    return sortRoles(this.props.roles);
  }
  get permissions(): Permission[] {
    return [...this.permissionSet];
  }

  hasRole(role: Role): boolean {
    return this.props.roles.includes(role);
  }

  can(permission: Permission): boolean {
    return this.permissionSet.has(permission);
  }

  isLocked(now: Date): boolean {
    return this.props.lockedUntil !== null && this.props.lockedUntil.getTime() > now.getTime();
  }

  /** Records a failed attempt and locks the account once the threshold is reached. */
  registerFailedLogin(
    now: Date,
    policy: { maxFailedAttempts: number; lockDurationMs: number },
  ): void {
    const failures = this.props.failedLoginCount + 1;
    if (failures >= policy.maxFailedAttempts) {
      this.props.failedLoginCount = 0;
      this.props.lockedUntil = new Date(now.getTime() + policy.lockDurationMs);
    } else {
      this.props.failedLoginCount = failures;
    }
  }

  registerSuccessfulLogin(now: Date): void {
    this.props.failedLoginCount = 0;
    this.props.lockedUntil = null;
    this.props.lastLoginAt = now;
  }

  changePassword(newHash: string, now: Date): void {
    this.props.passwordHash = newHash;
    this.props.passwordChangedAt = now;
    this.props.mustChangePassword = false;
  }

  toSessionUser(): SessionUser {
    return {
      id: this.props.id,
      employeeNo: this.props.employeeNo,
      email: this.props.email,
      name: this.props.name,
      roles: [...this.roles],
      permissions: this.permissions,
      mustChangePassword: this.props.mustChangePassword,
    };
  }

  /** Snapshot for persistence. */
  toProps(): Readonly<UserProps> {
    return { ...this.props, roles: [...this.props.roles], grants: [...this.props.grants] };
  }
}
