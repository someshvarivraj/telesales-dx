import type { Role, SessionUser } from '@telesales/shared';

export interface UserProps {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: Role;
  isTeamLead: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  failedLoginCount: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  passwordChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User aggregate. Holds the login-related business rules so services and
 * repositories stay free of policy decisions.
 */
export class User {
  private constructor(private props: UserProps) {}

  static restore(props: UserProps): User {
    return new User({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get email(): string {
    return this.props.email;
  }
  get displayName(): string {
    return this.props.displayName;
  }
  get passwordHash(): string {
    return this.props.passwordHash;
  }
  get role(): Role {
    return this.props.role;
  }
  get isTeamLead(): boolean {
    return this.props.isTeamLead;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get mustChangePassword(): boolean {
    return this.props.mustChangePassword;
  }
  get failedLoginCount(): number {
    return this.props.failedLoginCount;
  }
  get lockedUntil(): Date | null {
    return this.props.lockedUntil;
  }
  get lastLoginAt(): Date | null {
    return this.props.lastLoginAt;
  }
  get passwordChangedAt(): Date | null {
    return this.props.passwordChangedAt;
  }

  isLocked(now: Date): boolean {
    return this.props.lockedUntil !== null && this.props.lockedUntil.getTime() > now.getTime();
  }

  canAttemptLogin(now: Date): boolean {
    return this.props.isActive && !this.isLocked(now);
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
      email: this.props.email,
      displayName: this.props.displayName,
      role: this.props.role,
      isTeamLead: this.props.isTeamLead,
      mustChangePassword: this.props.mustChangePassword,
    };
  }

  /** Snapshot for persistence. */
  toProps(): Readonly<UserProps> {
    return { ...this.props };
  }
}
