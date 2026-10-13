import { isPermission, isRole, type Permission, type Role } from '@telesales/shared';
import { User } from '../../domain/user/User.js';
import type { NewUserData, UserRepository } from '../../domain/user/UserRepository.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';

type UserRecord = Prisma.UserGetPayload<{ include: ReturnType<PrismaUserRepository['include']> }>;

export class PrismaUserRepository implements UserRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly appKey: string,
  ) {}

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id }, include: this.include() });
    return record ? PrismaUserRepository.toDomain(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: this.include(),
    });
    return record ? PrismaUserRepository.toDomain(record) : null;
  }

  async findByEmployeeNo(employeeNo: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { employeeNo },
      include: this.include(),
    });
    return record ? PrismaUserRepository.toDomain(record) : null;
  }

  async create(data: NewUserData): Promise<User> {
    const record = await this.prisma.user.create({
      data: {
        employeeNo: data.employeeNo,
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        mustChangePassword: data.mustChangePassword,
        roles: { create: data.roles.map((role) => ({ appKey: this.appKey, role })) },
      },
      include: this.include(),
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

  private include() {
    return {
      roles: { where: { appKey: this.appKey }, select: { role: true } },
      permissionGrants: { where: { appKey: this.appKey }, select: { permission: true } },
    } as const;
  }

  private static toDomain(record: UserRecord): User {
    const { roles, permissionGrants, ...user } = record;
    return User.restore({
      ...user,
      roles: roles.map((row) => row.role as string).filter(isRole) as Role[],
      grants: permissionGrants.map((row) => row.permission).filter(isPermission) as Permission[],
    });
  }
}
