import type { Role } from '@telesales/shared';
import { User } from '../../domain/user/User.js';
import type { NewUserData, UserRepository } from '../../domain/user/UserRepository.js';
import type { PrismaClient, User as UserRecord } from '../../generated/prisma/client.js';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    return record ? PrismaUserRepository.toDomain(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return record ? PrismaUserRepository.toDomain(record) : null;
  }

  async create(data: NewUserData): Promise<User> {
    const record = await this.prisma.user.create({
      data: { ...data, email: data.email.toLowerCase() },
    });
    return PrismaUserRepository.toDomain(record);
  }

  async saveSecurityState(user: User): Promise<void> {
    const props = user.toProps();
    await this.prisma.user.update({
      where: { id: props.id },
      data: {
        passwordHash: props.passwordHash,
        mustChangePassword: props.mustChangePassword,
        failedLoginCount: props.failedLoginCount,
        lockedUntil: props.lockedUntil,
        lastLoginAt: props.lastLoginAt,
        passwordChangedAt: props.passwordChangedAt,
      },
    });
  }

  private static toDomain(record: UserRecord): User {
    return User.restore({ ...record, role: record.role as Role });
  }
}
