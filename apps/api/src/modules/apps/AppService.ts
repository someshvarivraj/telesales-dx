import {
  APP_KEY,
  type AppDto,
  type CreateAppRequest,
  ErrorCode,
  Permission,
  type UpdateAppRequest,
} from '@telesales/shared';
import type { RequestHandler } from 'express';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { Clock } from '../../domain/Clock.js';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { ConflictError, NotFoundError } from '../../http/errors/AppError.js';

const CACHE_MS = 10_000;

/**
 * Apps that share the company-wide accounts (spec §3, §6 app management, priority 2).
 * While an app is in maintenance only admins can use it.
 */
export class AppService {
  private cached: { maintenance: boolean; at: number } | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditLogger,
    private readonly clock: Clock,
  ) {}

  async list(): Promise<AppDto[]> {
    const rows = await this.prisma.app.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((row) => ({
      key: row.key,
      name: row.name,
      maintenanceMode: row.maintenanceMode,
      current: row.key === APP_KEY,
    }));
  }

  async create(actor: Actor, input: CreateAppRequest): Promise<AppDto> {
    try {
      const row = await this.prisma.app.create({ data: { key: input.key, name: input.name } });
      await this.audit.record({
        action: AuditAction.AppCreated,
        actorUserId: actor.id,
        targetType: 'app',
        targetId: row.key,
        after: { name: row.name },
      });
      return { key: row.key, name: row.name, maintenanceMode: false, current: false };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError({ field: 'key' });
      }
      throw error;
    }
  }

  async update(actor: Actor, key: string, input: UpdateAppRequest): Promise<AppDto> {
    const before = await this.prisma.app.findUnique({ where: { key } });
    if (!before) {
      throw new NotFoundError();
    }
    const row = await this.prisma.app.update({
      where: { key },
      data: { name: input.name, maintenanceMode: input.maintenanceMode },
    });
    this.cached = null;
    await this.audit.record({
      action: AuditAction.AppUpdated,
      actorUserId: actor.id,
      targetType: 'app',
      targetId: key,
      before: { name: before.name, maintenanceMode: before.maintenanceMode },
      after: { name: row.name, maintenanceMode: row.maintenanceMode },
    });
    return {
      key: row.key,
      name: row.name,
      maintenanceMode: row.maintenanceMode,
      current: row.key === APP_KEY,
    };
  }

  /** Whether this app is in maintenance (cached briefly; every request asks). */
  async inMaintenance(): Promise<boolean> {
    const now = this.clock.now().getTime();
    if (this.cached && now - this.cached.at < CACHE_MS) {
      return this.cached.maintenance;
    }
    const row = await this.prisma.app.findUnique({
      where: { key: APP_KEY },
      select: { maintenanceMode: true },
    });
    this.cached = { maintenance: row?.maintenanceMode ?? false, at: now };
    return this.cached.maintenance;
  }

  /** Blocks everyone but admins while the app is in maintenance (503 MAINTENANCE). */
  gate(): RequestHandler {
    return async (req, res, next) => {
      if (req.currentUser?.can(Permission.Administer) || !(await this.inMaintenance())) {
        next();
        return;
      }
      res.status(503).json({ error: { code: ErrorCode.Maintenance } });
    };
  }
}
