import type { ListAnalyticsList, ListAnalyticsResponse } from '@telesales/shared';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { iso } from '../../http/mappers.js';

/** Digits of every value in a row as read, to find the phone number whatever its header. */
function phoneDigitsIn(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return [];
  return Object.values(raw as Record<string, unknown>)
    .map((value) =>
      String(value ?? '')
        .normalize('NFKC')
        .replace(/\D/g, ''),
    )
    .filter((digits) => digits.length >= 10 && digits.length <= 11);
}

/**
 * リスト分析 (request 11/27): the company buys its lists, and the same company can come in
 * several of them. Each list's share of new and known companies, the lists that overlap most,
 * and the companies that keep coming back.
 */
export class ListAnalyticsService {
  constructor(private readonly prisma: PrismaClient) {}

  async analyse(): Promise<ListAnalyticsResponse> {
    const imports = await this.prisma.listImport.findMany({
      orderBy: { createdAt: 'asc' },
      take: 1000,
      select: { id: true, listName: true, purpose: true, createdAt: true, rowCount: true },
    });
    const rows = await this.prisma.listImportRow.findMany({
      where: { listImportId: { in: imports.map((item) => item.id) } },
      select: { listImportId: true, companyId: true, status: true },
    });
    // Duplicates left out before 11/27 have no company: matched again by phone number.
    const unlinked = await this.prisma.listImportRow.findMany({
      where: {
        listImportId: { in: imports.map((item) => item.id) },
        status: 'DUPLICATE',
        companyId: null,
      },
      select: { id: true, listImportId: true, rawData: true },
    });
    const digits = [...new Set(unlinked.flatMap((row) => phoneDigitsIn(row.rawData)))];
    const byPhone = new Map(
      (
        await this.prisma.company.findMany({
          where: { phoneDigits: { in: digits } },
          select: { id: true, phoneDigits: true },
          orderBy: { createdAt: 'asc' },
        })
      ).map((company) => [company.phoneDigits, company.id] as const),
    );
    const links = [
      ...rows
        .filter((row) => row.companyId)
        .map((row) => ({
          listImportId: row.listImportId,
          companyId: row.companyId as string,
        })),
      ...unlinked.flatMap((row) => {
        const companyId = phoneDigitsIn(row.rawData)
          .map((d) => byPhone.get(d))
          .find(Boolean);
        return companyId ? [{ listImportId: row.listImportId, companyId }] : [];
      }),
    ];

    // A flagged copy counts as the company it copies.
    const companies = await this.prisma.company.findMany({
      where: { id: { in: [...new Set(links.map((link) => link.companyId))] } },
      select: { id: true, name: true, phone: true, flagMatchId: true },
    });
    const canonical = new Map(companies.map((c) => [c.id, c.flagMatchId ?? c.id]));
    const companyById = new Map(companies.map((c) => [c.id, c]));
    const listsOf = new Map<string, Set<string>>(); // company → lists
    const companiesOf = new Map<string, Set<string>>(); // list → companies
    for (const link of links) {
      const id = canonical.get(link.companyId) ?? link.companyId;
      if (!listsOf.has(id)) listsOf.set(id, new Set());
      listsOf.get(id)?.add(link.listImportId);
      if (!companiesOf.has(link.listImportId)) companiesOf.set(link.listImportId, new Set());
      companiesOf.get(link.listImportId)?.add(id);
    }

    const appointments = await this.prisma.appointment.findMany({
      where: { companyId: { in: [...listsOf.keys()] } },
      select: { companyId: true, createdAt: true },
    });
    const meta = new Map(imports.map((item) => [item.id, item]));
    const count = (listImportId: string, status: string) =>
      rows.filter((row) => row.listImportId === listImportId && row.status === status).length;

    const lists: ListAnalyticsList[] = imports.map((item, index) => {
      const mine = companiesOf.get(item.id) ?? new Set<string>();
      const overlaps = imports
        .slice(0, index)
        .map((earlier) => {
          const theirs = companiesOf.get(earlier.id) ?? new Set<string>();
          let shared = 0;
          mine.forEach((id) => {
            if (theirs.has(id)) shared += 1;
          });
          return { listImportId: earlier.id, listName: earlier.listName, shared };
        })
        .filter((overlap) => overlap.shared > 0)
        .sort((a, b) => b.shared - a.shared)
        .slice(0, 3);
      return {
        id: item.id,
        listName: item.listName,
        importedAt: iso(item.createdAt),
        purpose: item.purpose,
        rows: item.rowCount,
        created: count(item.id, 'IMPORTED'),
        duplicates: count(item.id, 'DUPLICATE'),
        needsCheck: count(item.id, 'NEEDS_CHECK'),
        problems: count(item.id, 'INVALID'),
        avoided: count(item.id, 'AVOIDED'),
        noPhone: count(item.id, 'NO_PHONE'),
        appointments: new Set(
          appointments
            .filter((a) => mine.has(a.companyId) && a.createdAt >= item.createdAt)
            .map((a) => a.companyId),
        ).size,
        overlaps,
      };
    });

    const repeated = [...listsOf.entries()]
      .filter(([, ids]) => ids.size >= 2)
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 100)
      .flatMap(([companyId, ids]) => {
        const company = companyById.get(companyId);
        if (!company) return [];
        return [
          {
            company: { id: company.id, name: company.name, phone: company.phone },
            lists: [...ids]
              .flatMap((id) => {
                const list = meta.get(id);
                return list
                  ? [{ listImportId: id, listName: list.listName, importedAt: iso(list.createdAt) }]
                  : [];
              })
              .sort((a, b) => a.importedAt.localeCompare(b.importedAt)),
          },
        ];
      });

    return {
      totals: {
        lists: lists.length,
        rows: lists.reduce((sum, list) => sum + list.rows, 0),
        created: lists.reduce((sum, list) => sum + list.created, 0),
        duplicates: lists.reduce((sum, list) => sum + list.duplicates, 0),
        problems: lists.reduce((sum, list) => sum + list.problems, 0),
        repeatedCompanies: [...listsOf.values()].filter((ids) => ids.size >= 2).length,
      },
      // Newest first on screen.
      lists: lists.reverse(),
      repeated,
    };
  }
}
