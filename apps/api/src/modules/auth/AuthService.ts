import type { LoginPolicy } from '../../config/AppConfig.js';
import {
  AuditAction,
  type AuditLogger,
  type RequestContext,
} from '../../domain/audit/AuditLogger.js';
import type { Clock } from '../../domain/Clock.js';
import type { PasswordHasher } from '../../domain/security/PasswordHasher.js';
import type { User } from '../../domain/user/User.js';
import type { UserRepository } from '../../domain/user/UserRepository.js';
import {
  AccountLockedError,
  InvalidCredentialsError,
  PasswordReuseError,
} from '../../http/errors/AppError.js';

export class AuthService {
  /** Verified against when the email is unknown, so response time does not reveal accounts. */
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly audit: AuditLogger,
    private readonly clock: Clock,
    private readonly policy: LoginPolicy,
  ) {}

  async login(email: string, password: string, context: RequestContext): Promise<User> {
    const now = this.clock.now();
    const user = await this.users.findByEmail(email);

    if (!user) {
      await this.hasher.verify(await this.getDummyHash(), password);
      await this.audit.record({
        action: AuditAction.LoginFailed,
        metadata: { reason: 'unknown_email' },
        context,
      });
      throw new InvalidCredentialsError();
    }

    if (!user.isActive) {
      await this.audit.record({
        action: AuditAction.LoginFailed,
        actorUserId: user.id,
        metadata: { reason: 'inactive' },
        context,
      });
      throw new InvalidCredentialsError();
    }

    if (user.isLocked(now)) {
      await this.audit.record({
        action: AuditAction.LoginFailed,
        actorUserId: user.id,
        metadata: { reason: 'locked' },
        context,
      });
      throw new AccountLockedError();
    }

    const valid = await this.hasher.verify(user.passwordHash, password);
    if (!valid) {
      user.registerFailedLogin(now, this.policy);
      await this.users.saveSecurityState(user);
      if (user.isLocked(now)) {
        await this.audit.record({
          action: AuditAction.AccountLocked,
          actorUserId: user.id,
          context,
        });
        throw new AccountLockedError();
      }
      await this.audit.record({
        action: AuditAction.LoginFailed,
        actorUserId: user.id,
        metadata: { reason: 'wrong_password' },
        context,
      });
      throw new InvalidCredentialsError();
    }

    user.registerSuccessfulLogin(now);
    await this.users.saveSecurityState(user);
    await this.audit.record({ action: AuditAction.LoginSucceeded, actorUserId: user.id, context });
    return user;
  }

  async changePassword(
    user: User,
    currentPassword: string,
    newPassword: string,
    context: RequestContext,
  ): Promise<void> {
    const valid = await this.hasher.verify(user.passwordHash, currentPassword);
    if (!valid) {
      throw new InvalidCredentialsError();
    }
    if (currentPassword === newPassword) {
      throw new PasswordReuseError();
    }
    user.changePassword(await this.hasher.hash(newPassword), this.clock.now());
    await this.users.saveSecurityState(user);
    await this.audit.record({ action: AuditAction.PasswordChanged, actorUserId: user.id, context });
  }

  async recordLogout(userId: string, context: RequestContext): Promise<void> {
    await this.audit.record({ action: AuditAction.Logout, actorUserId: userId, context });
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash('dummy-password-for-timing-equalisation');
    return this.dummyHash;
  }
}
