import { Role } from '@telesales/shared';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { PasswordHasher } from '../../domain/security/PasswordHasher.js';
import type { User } from '../../domain/user/User.js';
import type { UserRepository } from '../../domain/user/UserRepository.js';
import type { TemporaryPasswordGenerator } from '../../infrastructure/security/TemporaryPasswordGenerator.js';

export interface CreateUserInput {
  email: string;
  displayName: string;
  role: Role;
  isTeamLead: boolean;
  createdBy?: string | null;
}

export interface CreatedUser {
  user: User;
  /** Shown once to the administrator; the user must change it on first login. */
  temporaryPassword: string;
}

export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`A user with email ${email} already exists`);
    this.name = 'DuplicateEmailError';
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
    if (await this.users.findByEmail(email)) {
      throw new DuplicateEmailError(email);
    }
    if (input.isTeamLead && input.role !== Role.Telema) {
      throw new Error('Only telemarketing users can be team leads');
    }

    const temporaryPassword = this.passwords.generate();
    const user = await this.users.create({
      email,
      displayName: input.displayName.trim(),
      passwordHash: await this.hasher.hash(temporaryPassword),
      role: input.role,
      isTeamLead: input.isTeamLead,
      mustChangePassword: true,
    });

    await this.audit.record({
      action: AuditAction.UserCreated,
      actorUserId: input.createdBy ?? null,
      targetType: 'user',
      targetId: user.id,
      metadata: { role: user.role, isTeamLead: user.isTeamLead },
    });

    return { user, temporaryPassword };
  }
}
