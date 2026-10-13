import { type Role } from '@telesales/shared';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { PasswordHasher } from '../../domain/security/PasswordHasher.js';
import type { User } from '../../domain/user/User.js';
import type { UserRepository } from '../../domain/user/UserRepository.js';
import type { TemporaryPasswordGenerator } from '../../infrastructure/security/TemporaryPasswordGenerator.js';

export interface CreateUserInput {
  employeeNo: string | null;
  name: string;
  email: string;
  roles: Role[];
  createdBy?: string | null;
}

export interface CreatedUser {
  user: User;
  /** Shown once to the administrator; the user must change it on first login. */
  temporaryPassword: string;
}

export class UserValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserValidationError';
  }
}

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly passwords: TemporaryPasswordGenerator,
    private readonly audit: AuditLogger,
  ) {}

  async createUser(input: CreateUserInput): Promise<CreatedUser> {
    const email = input.email.trim().toLowerCase();
    const employeeNo = input.employeeNo?.trim() || null;
    const roles = [...new Set(input.roles)];

    if (roles.length === 0) {
      throw new UserValidationError('At least one role is required');
    }
    if (await this.users.findByEmail(email)) {
      throw new UserValidationError(`A user with email ${email} already exists`);
    }
    if (employeeNo && (await this.users.findByEmployeeNo(employeeNo))) {
      throw new UserValidationError(`A user with employee no. ${employeeNo} already exists`);
    }

    const temporaryPassword = this.passwords.generate();
    const user = await this.users.create({
      employeeNo,
      name: input.name.trim(),
      email,
      passwordHash: await this.hasher.hash(temporaryPassword),
      roles,
      mustChangePassword: true,
    });

    await this.audit.record({
      action: AuditAction.UserCreated,
      actorUserId: input.createdBy ?? null,
      targetType: 'user',
      targetId: user.id,
      after: {
        email: user.email,
        employeeNo: user.employeeNo,
        name: user.name,
        roles: [...user.roles],
      },
    });

    return { user, temporaryPassword };
  }
}
