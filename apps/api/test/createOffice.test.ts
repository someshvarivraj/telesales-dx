import { createOfficeRequestSchema } from '@telesales/shared';
import { describe, expect, it } from 'vitest';
import type { Actor } from '../src/domain/access/AccessPolicy.js';
import type { AuditLogger } from '../src/domain/audit/AuditLogger.js';
import type { Clock } from '../src/domain/Clock.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { ConflictError } from '../src/http/errors/AppError.js';
import { CompanyService } from '../src/modules/companies/CompanyService.js';

const FROM = '11111111-1111-4111-8111-111111111111';
const actor = { id: 'u1' } as Actor;

function setup(found: { company?: object; avoided?: object } = {}) {
  const created: Record<string, unknown>[] = [];
  const prisma = {
    company: {
      findUnique: async () => ({
        id: FROM,
        nameKey: 'モラブ',
        parentId: null,
        listName: '20261106_資料①',
        autoAllocate: false,
      }),
      findFirst: async () => found.company ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: 'new', parentId: data.parentId };
      },
    },
    avoidPhone: { findUnique: async () => found.avoided ?? null },
  } as unknown as PrismaClient;
  const audit = { record: async () => undefined } as unknown as AuditLogger;
  const service = new CompanyService(prisma, audit, { now: () => new Date() } as Clock);
  // The detail screen is loaded after saving; not under test here.
  service.get = async (id: string) => ({ id }) as never;
  return { service, created };
}

const input = (phone: string, name = '株式会社モラブ') =>
  createOfficeRequestSchema.parse({ name, office: '大阪支店', phone });

describe('別の事業所・支店を新規登録 (answer 11/10 No.10, No.11)', () => {
  it('needs a phone number of 10–11 digits', () => {
    expect(createOfficeRequestSchema.safeParse({ name: 'A社', phone: '' }).success).toBe(false);
    expect(createOfficeRequestSchema.safeParse({ name: 'A社', phone: '06-1234' }).success).toBe(
      false,
    );
    expect(
      createOfficeRequestSchema.safeParse({ name: 'A社', phone: '０６-６１２３-４５６７' }).success,
    ).toBe(true);
  });

  it('creates it on the call list, grouped with the company it was found on', async () => {
    const { service, created } = setup();
    await service.createOffice(actor, FROM, input('06-6123-4567'));
    expect(created[0]).toMatchObject({
      phoneDigits: '0661234567',
      office: '大阪支店',
      isCallTarget: true,
      autoAllocate: false,
      listName: '20261106_資料①',
      parentId: FROM,
      createdById: 'u1',
    });
  });

  it('does not group a company with another name', async () => {
    const { service, created } = setup();
    await service.createOffice(actor, FROM, input('06-6123-4567', '別会社株式会社'));
    expect(created[0]).toMatchObject({ parentId: null });
  });

  it('refuses a phone number that is registered already, whatever the name', async () => {
    const { service, created } = setup({
      company: { id: 'c2', name: '株式会社ほか', office: null },
    });
    const error = await service
      .createOffice(actor, FROM, input('06-6123-4567'))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).details).toMatchObject({
      reason: 'phone_registered',
      companyId: 'c2',
    });
    expect(created).toHaveLength(0);
  });

  it('refuses a phone number on the 回避 list', async () => {
    const { service } = setup({ avoided: { companyName: '回避の会社' } });
    const error = await service
      .createOffice(actor, FROM, input('06-6123-4567'))
      .catch((e: unknown) => e);
    expect((error as ConflictError).details).toMatchObject({ reason: 'phone_avoided' });
  });
});
