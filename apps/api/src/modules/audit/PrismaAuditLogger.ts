import type { Logger } from 'pino';
import type { AuditEntry, AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';

/**
 * Writes audit entries to the database. A failure to audit must not break the
 * user's request, so errors are logged instead of thrown.
 */
export class PrismaAuditLogger implements AuditLogger {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          actorUserId: entry.actorUserId ?? null,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          ipAddress: entry.context?.ipAddress?.slice(0, 45) ?? null,
          userAgent: entry.context?.userAgent?.slice(0, 512) ?? null,
          metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      this.logger.error({ err: error, action: entry.action }, 'failed to write audit log');
    }
  }
}
