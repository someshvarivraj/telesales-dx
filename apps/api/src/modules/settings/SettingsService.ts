import type { AppSettingsDto } from '@telesales/shared';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import type { PrismaClient } from '../../generated/prisma/client.js';

const TRAVEL_BUFFER_KEY = 'travel_buffer';
const ALLOCATION_KEY = 'allocation';
const CHANGE_REQUEST_REMINDER_KEY = 'change_request_reminder';

const DEFAULTS: AppSettingsDto = {
  travelBufferMinutes: 0,
  travelBufferMode: 'WARN',
  allocationRunTime: '08:30',
  changeRequestReminderMinutes: 120,
};

interface TravelBufferValue {
  minutes: number;
  mode: 'WARN' | 'BLOCK';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTravelBuffer(value: unknown): value is TravelBufferValue {
  return (
    isRecord(value) &&
    typeof value.minutes === 'number' &&
    (value.mode === 'WARN' || value.mode === 'BLOCK')
  );
}

/** Small system-wide settings stored as data so they change without a deploy. */
export class SettingsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditLogger,
  ) {}

  async get(): Promise<AppSettingsDto> {
    const rows = await this.prisma.appSetting.findMany({
      where: { key: { in: [TRAVEL_BUFFER_KEY, ALLOCATION_KEY, CHANGE_REQUEST_REMINDER_KEY] } },
    });
    const value = (key: string) => rows.find((row) => row.key === key)?.value;
    const travel = value(TRAVEL_BUFFER_KEY);
    const allocation = value(ALLOCATION_KEY);
    const reminder = value(CHANGE_REQUEST_REMINDER_KEY);
    return {
      travelBufferMinutes: isTravelBuffer(travel) ? travel.minutes : DEFAULTS.travelBufferMinutes,
      travelBufferMode: isTravelBuffer(travel) ? travel.mode : DEFAULTS.travelBufferMode,
      allocationRunTime:
        isRecord(allocation) && typeof allocation.runTime === 'string'
          ? allocation.runTime
          : DEFAULTS.allocationRunTime,
      changeRequestReminderMinutes:
        isRecord(reminder) && typeof reminder.minutes === 'number'
          ? reminder.minutes
          : DEFAULTS.changeRequestReminderMinutes,
    };
  }

  async update(actor: Actor, input: AppSettingsDto): Promise<AppSettingsDto> {
    const before = await this.get();
    const values: [string, Record<string, string | number>][] = [
      [TRAVEL_BUFFER_KEY, { minutes: input.travelBufferMinutes, mode: input.travelBufferMode }],
      [ALLOCATION_KEY, { runTime: input.allocationRunTime }],
      [CHANGE_REQUEST_REMINDER_KEY, { minutes: input.changeRequestReminderMinutes }],
    ];
    await this.prisma.$transaction(
      values.map(([key, value]) =>
        this.prisma.appSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        }),
      ),
    );
    await this.audit.record({
      action: AuditAction.SettingsChanged,
      actorUserId: actor.id,
      targetType: 'app_setting',
      before: { ...before },
      after: { ...input },
    });
    return input;
  }
}
