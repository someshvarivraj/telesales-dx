import type { AppSettingsDto } from '@telesales/shared';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import type { PrismaClient } from '../../generated/prisma/client.js';

const TRAVEL_BUFFER_KEY = 'travel_buffer';

interface TravelBufferValue {
  minutes: number;
  mode: 'WARN' | 'BLOCK';
}

function isTravelBuffer(value: unknown): value is TravelBufferValue {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.minutes === 'number' && (record.mode === 'WARN' || record.mode === 'BLOCK');
}

/** Small system-wide settings stored as data so they change without a deploy. */
export class SettingsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditLogger,
  ) {}

  async get(): Promise<AppSettingsDto> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: TRAVEL_BUFFER_KEY } });
    const value = isTravelBuffer(row?.value) ? row.value : { minutes: 0, mode: 'WARN' as const };
    return { travelBufferMinutes: value.minutes, travelBufferMode: value.mode };
  }

  async update(actor: Actor, input: AppSettingsDto): Promise<AppSettingsDto> {
    const before = await this.get();
    const value: TravelBufferValue = {
      minutes: input.travelBufferMinutes,
      mode: input.travelBufferMode,
    };
    await this.prisma.appSetting.upsert({
      where: { key: TRAVEL_BUFFER_KEY },
      update: { value: { ...value } },
      create: { key: TRAVEL_BUFFER_KEY, value: { ...value } },
    });
    await this.audit.record({
      action: AuditAction.SettingsChanged,
      actorUserId: actor.id,
      targetType: 'app_setting',
      targetId: TRAVEL_BUFFER_KEY,
      before: { ...before },
      after: { ...input },
    });
    return input;
  }
}
