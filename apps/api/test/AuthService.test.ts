import { Role } from '@telesales/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditAction } from '../src/domain/audit/AuditLogger.js';
import {
  AccountLockedError,
  InvalidCredentialsError,
  PasswordReuseError,
} from '../src/http/errors/AppError.js';
import { AuthService } from '../src/modules/auth/AuthService.js';
import {
  FixedClock,
  InMemoryAuditLogger,
  InMemoryUserRepository,
  PlainPasswordHasher,
} from './support/fakes.js';

const PASSWORD = 'correct-horse-battery';
const policy = { maxFailedAttempts: 3, lockDurationMs: 15 * 60_000 };

describe('AuthService', () => {
  let users: InMemoryUserRepository;
  let audit: InMemoryAuditLogger;
  let clock: FixedClock;
  let service: AuthService;
  const hasher = new PlainPasswordHasher();

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    audit = new InMemoryAuditLogger();
    clock = new FixedClock(new Date('2026-10-09T09:00:00+09:00'));
    service = new AuthService(users, hasher, audit, clock, policy);
    await users.create({
      email: 'tanaka@example.co.jp',
      employeeNo: '1001',
      name: '田中',
      passwordHash: await hasher.hash(PASSWORD),
      roles: [Role.Telema],
      mustChangePassword: false,
    });
  });

  it('logs in with valid credentials and resets the failure counter', async () => {
    const user = await service.login('tanaka@example.co.jp', PASSWORD, {});
    expect(user.lastLoginAt).toEqual(clock.now());
    expect(user.failedLoginCount).toBe(0);
    expect(audit.actions()).toContain(AuditAction.LoginSucceeded);
  });

  it('rejects an unknown email with the same error as a wrong password', async () => {
    await expect(service.login('nobody@example.co.jp', PASSWORD, {})).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('locks the account after the configured number of failures', async () => {
    await expect(service.login('tanaka@example.co.jp', 'wrong', {})).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    await expect(service.login('tanaka@example.co.jp', 'wrong', {})).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    await expect(service.login('tanaka@example.co.jp', 'wrong', {})).rejects.toBeInstanceOf(
      AccountLockedError,
    );

    await expect(service.login('tanaka@example.co.jp', PASSWORD, {})).rejects.toBeInstanceOf(
      AccountLockedError,
    );
    expect(audit.actions()).toContain(AuditAction.AccountLocked);
  });

  it('allows login again once the lock expires', async () => {
    for (let i = 0; i < policy.maxFailedAttempts; i += 1) {
      await service.login('tanaka@example.co.jp', 'wrong', {}).catch(() => undefined);
    }
    clock.advance(policy.lockDurationMs + 1);
    await expect(service.login('tanaka@example.co.jp', PASSWORD, {})).resolves.toBeDefined();
  });

  it('changes the password and clears the must-change flag', async () => {
    const user = await service.login('tanaka@example.co.jp', PASSWORD, {});
    await service.changePassword(user, PASSWORD, 'a-brand-new-password', {});
    const reloaded = await users.findById(user.id);
    expect(reloaded?.mustChangePassword).toBe(false);
    expect(await hasher.verify(reloaded?.passwordHash ?? '', 'a-brand-new-password')).toBe(true);
  });

  it('refuses to reuse the current password', async () => {
    const user = await service.login('tanaka@example.co.jp', PASSWORD, {});
    await expect(service.changePassword(user, PASSWORD, PASSWORD, {})).rejects.toBeInstanceOf(
      PasswordReuseError,
    );
  });
});
