import type { updateUserRequestSchema } from '@telesales/shared';
import {
  type AdminUserDto,
  APP_KEY,
  type CreateUserRequest,
  isPermission,
  isRole,
  type PersonDto,
  Role,
  sortRoles,
  type TemporaryPasswordResponse,
} from '@telesales/shared';
import type { z } from 'zod';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import type { Clock } from '../../domain/Clock.js';
import type { PasswordHasher } from '../../domain/security/PasswordHasher.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { ConflictError, InvalidStateError, NotFoundError } from '../../http/errors/AppError.js';
import { iso } from '../../http/mappers.js';
import type { TemporaryPasswordGenerator } from '../../infrastructure/security/TemporaryPasswordGenerator.js';
import { type UserService, UserValidationError } from '../users/UserService.js';

type UpdateUserCommand = z.output<typeof updateUserRequestSchema>;

const userInclude = {
  roles: { where: { appKey: APP_KEY } },
  permissionGrants: { where: { appKey: APP_KEY } },
  telemarketer: true,
} satisfies Prisma.UserInclude;

type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>;

/**
 * Users and roles (spec §4 Q4): admins add and change users; leavers are disabled,
 * never deleted. Individual grants keep exceptions as data (e.g. the area-table editor).
 */
export class AdminUserService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly users: UserService,
    private readonly hasher: PasswordHasher,
    private readonly passwords: TemporaryPasswordGenerator,
    private readonly audit: AuditLogger,
    private readonly clock: Clock,
  ) {}

  async list(): Promise<AdminUserDto[]> {
    const rows = await this.prisma.user.findMany({
      include: userInclude,
      orderBy: [{ status: 'asc' }, { employeeNo: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.toDto(row));
  }

  /** Active people for pickers (rep, attendee, booker), optionally by role. */
  async people(role?: Role): Promise<PersonDto[]> {
    const rows = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', ...(role ? { roles: { some: { appKey: APP_KEY, role } } } : {}) },
      include: { roles: { where: { appKey: APP_KEY } } },
      orderBy: [{ employeeNo: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      roles: sortRoles(row.roles.map((r) => r.role).filter(isRole)),
    }));
  }

  async create(actor: Actor, input: CreateUserRequest): Promise<TemporaryPasswordResponse> {
    try {
      const created = await this.users.createUser({
        employeeNo: input.employeeNo ?? null,
        name: input.name,
        email: input.email,
        roles: input.roles,
        createdBy: actor.id,
      });
      const row = await this.prisma.user.findUniqueOrThrow({
        where: { id: created.user.id },
        include: userInclude,
      });
      return { user: this.toDto(row), temporaryPassword: created.temporaryPassword };
    } catch (error) {
      if (error instanceof UserValidationError) {
        throw new ConflictError({
          reason: error.message.includes('employee') ? 'employee_no_exists' : 'email_exists',
        });
      }
      throw error;
    }
  }

  async update(actor: Actor, id: string, input: UpdateUserCommand): Promise<AdminUserDto> {
    const before = await this.prisma.user.findUnique({ where: { id }, include: userInclude });
    if (!before) {
      throw new NotFoundError();
    }
    const email = input.email.toLowerCase();
    const clash = await this.prisma.user.findFirst({
      where: {
        id: { not: id },
        OR: [{ email }, ...(input.employeeNo ? [{ employeeNo: input.employeeNo }] : [])],
      },
      select: { email: true },
    });
    if (clash) {
      throw new ConflictError({
        reason: clash.email === email ? 'email_exists' : 'employee_no_exists',
      });
    }
    // Never leave the system without an active admin.
    const removesAdmin =
      before.roles.some((r) => r.role === Role.Admin) &&
      (!input.roles.includes(Role.Admin) || input.status === 'DISABLED');
    if (removesAdmin) {
      const otherAdmins = await this.prisma.user.count({
        where: {
          id: { not: id },
          status: 'ACTIVE',
          roles: { some: { appKey: APP_KEY, role: Role.Admin } },
        },
      });
      if (otherAdmins === 0) {
        throw new InvalidStateError({ reason: 'last_admin' });
      }
    }

    const isTelema = input.roles.includes(Role.Telema) || input.roles.includes(Role.TelemaLead);
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.userAppRole.deleteMany({ where: { userId: id, appKey: APP_KEY } });
      await tx.userPermissionGrant.deleteMany({ where: { userId: id, appKey: APP_KEY } });
      if (isTelema && input.telemarketer) {
        await tx.telemarketerProfile.upsert({
          where: { userId: id },
          update: input.telemarketer,
          create: { userId: id, ...input.telemarketer },
        });
      }
      return tx.user.update({
        where: { id },
        data: {
          name: input.name,
          email,
          employeeNo: input.employeeNo ?? null,
          status: input.status,
          roles: { create: [...new Set(input.roles)].map((role) => ({ appKey: APP_KEY, role })) },
          permissionGrants: {
            create: [...new Set(input.grants)].map((permission) => ({
              appKey: APP_KEY,
              permission,
              grantedById: actor.id,
            })),
          },
        },
        include: userInclude,
      });
    });
    if (input.status === 'DISABLED') {
      await this.endSessions(id);
    }
    const beforeDto = this.toDto(before);
    const afterDto = this.toDto(row);
    const rolesChanged =
      beforeDto.roles.join() !== afterDto.roles.join() ||
      beforeDto.grants.join() !== afterDto.grants.join();
    await this.audit.record({
      action: rolesChanged ? AuditAction.RolesChanged : AuditAction.UserUpdated,
      actorUserId: actor.id,
      targetType: 'user',
      targetId: id,
      before: this.auditShape(beforeDto),
      after: this.auditShape(afterDto),
    });
    return afterDto;
  }

  /** New temporary password (shown once); the user must change it at next login. */
  async resetPassword(actor: Actor, id: string): Promise<TemporaryPasswordResponse> {
    const exists = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundError();
    }
    const temporaryPassword = this.passwords.generate();
    const row = await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await this.hasher.hash(temporaryPassword),
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
      },
      include: userInclude,
    });
    await this.endSessions(id);
    await this.audit.record({
      action: AuditAction.PasswordReset,
      actorUserId: actor.id,
      targetType: 'user',
      targetId: id,
    });
    return { user: this.toDto(row), temporaryPassword };
  }

  async unlock(actor: Actor, id: string): Promise<AdminUserDto> {
    const row = await this.prisma.user.update({
      where: { id },
      data: { failedLoginCount: 0, lockedUntil: null },
      include: userInclude,
    });
    await this.audit.record({
      action: AuditAction.UserUpdated,
      actorUserId: actor.id,
      targetType: 'user',
      targetId: id,
      after: { unlocked: true },
    });
    return this.toDto(row);
  }

  /** Signs the user out everywhere (sessions live in the `session` table). */
  private async endSessions(userId: string): Promise<void> {
    await this.prisma.$executeRaw`DELETE FROM "session" WHERE sess->>'userId' = ${userId}`;
  }

  private auditShape(dto: AdminUserDto): Record<string, unknown> {
    return {
      name: dto.name,
      email: dto.email,
      employeeNo: dto.employeeNo,
      status: dto.status,
      roles: dto.roles,
      grants: dto.grants,
      telemarketer: dto.telemarketer,
    };
  }

  private toDto(row: UserRow): AdminUserDto {
    return {
      id: row.id,
      employeeNo: row.employeeNo,
      name: row.name,
      email: row.email,
      status: row.status,
      roles: sortRoles(row.roles.map((r) => r.role).filter(isRole)),
      grants: row.permissionGrants.map((grant) => grant.permission).filter(isPermission),
      lastLoginAt: iso(row.lastLoginAt),
      isLocked: Boolean(row.lockedUntil && row.lockedUntil > this.clock.now()),
      mustChangePassword: row.mustChangePassword,
      telemarketer: row.telemarketer
        ? {
            isAllocationTarget: row.telemarketer.isAllocationTarget,
            territory: row.telemarketer.territory,
          }
        : null,
    };
  }
}
