import { Role } from '@telesales/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditAction } from '../src/domain/audit/AuditLogger.js';
import { TemporaryPasswordGenerator } from '../src/infrastructure/security/TemporaryPasswordGenerator.js';
import { UserService, UserValidationError } from '../src/modules/users/UserService.js';
import {
  InMemoryAuditLogger,
  InMemoryUserRepository,
  PlainPasswordHasher,
} from './support/fakes.js';

describe('UserService', () => {
  let users: InMemoryUserRepository;
  let audit: InMemoryAuditLogger;
  let service: UserService;
  const hasher = new PlainPasswordHasher();

  beforeEach(() => {
    users = new InMemoryUserRepository();
    audit = new InMemoryAuditLogger();
    service = new UserService(users, hasher, new TemporaryPasswordGenerator(), audit);
  });

  it('creates a user with several roles and a temporary password that must be changed', async () => {
    const { user, temporaryPassword } = await service.createUser({
      employeeNo: '1234',
      name: '佐藤 花子',
      email: 'Sato@Example.co.jp',
      roles: [Role.TelemaLead, Role.Telema, Role.Telema],
    });

    expect(user.email).toBe('sato@example.co.jp');
    expect(user.roles).toEqual([Role.Telema, Role.TelemaLead]);
    expect(user.mustChangePassword).toBe(true);
    expect(temporaryPassword.length).toBeGreaterThanOrEqual(16);
    expect(await hasher.verify(user.passwordHash, temporaryPassword)).toBe(true);
    expect(audit.entries[0]).toMatchObject({ action: AuditAction.UserCreated, targetId: user.id });
    expect(audit.entries[0]?.after).toMatchObject({ roles: [Role.Telema, Role.TelemaLead] });
  });

  it('requires at least one role', async () => {
    await expect(
      service.createUser({ employeeNo: null, name: 'x', email: 'x@example.co.jp', roles: [] }),
    ).rejects.toBeInstanceOf(UserValidationError);
  });

  it('rejects a duplicate email or employee number', async () => {
    await service.createUser({
      employeeNo: '1',
      name: 'a',
      email: 'a@example.co.jp',
      roles: [Role.Sales],
    });
    await expect(
      service.createUser({
        employeeNo: '2',
        name: 'b',
        email: 'A@example.co.jp',
        roles: [Role.Sales],
      }),
    ).rejects.toBeInstanceOf(UserValidationError);
    await expect(
      service.createUser({
        employeeNo: '1',
        name: 'c',
        email: 'c@example.co.jp',
        roles: [Role.Sales],
      }),
    ).rejects.toBeInstanceOf(UserValidationError);
  });
});
