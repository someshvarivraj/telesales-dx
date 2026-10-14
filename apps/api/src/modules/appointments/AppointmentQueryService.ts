import type { appointmentListQuerySchema } from '@telesales/shared';
import {
  addDays,
  type AppointmentDetail,
  type AppointmentListItem,
  AppointmentSource,
  AppointmentStatus,
  type ChangeRequestListItem,
  fromJst,
  jstDate,
  type Page,
} from '@telesales/shared';
import type { z } from 'zod';
import type { AccessPolicy, Actor, AppointmentFacts } from '../../domain/access/AccessPolicy.js';
import type { CalendarRepository } from '../../domain/calendar/CalendarRepository.js';
import type { Clock } from '../../domain/Clock.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { NotFoundError } from '../../http/errors/AppError.js';
import { userRefSelect } from '../../http/mappers.js';
import {
  appointmentDetailInclude,
  type AppointmentDetailRow,
  appointmentListInclude,
  attendeeIdsOf,
  toChangeRequestDto,
  toDetail,
  toListItem,
} from './appointmentMapping.js';

type ListQuery = z.output<typeof appointmentListQuerySchema>;

export function factsOf(row: AppointmentDetailRow): AppointmentFacts {
  return {
    source: row.source,
    status: row.status,
    salesRepId: row.salesRepId,
    bookedById: row.bookedById,
    attendeeIds: attendeeIdsOf(row),
    hasOpenChangeRequest: row.changeRequests.some(
      (request) => request.status === 'REQUESTED' || request.status === 'IN_PROGRESS',
    ),
  };
}

/** Read side of appointments: the shared page, the list and the work lists. */
export class AppointmentQueryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly policy: AccessPolicy,
    private readonly calendar: CalendarRepository,
    private readonly clock: Clock,
  ) {}

  async loadRow(id: string): Promise<AppointmentDetailRow> {
    const row = await this.prisma.appointment.findUnique({
      where: { id },
      include: appointmentDetailInclude,
    });
    if (!row) {
      throw new NotFoundError();
    }
    return row;
  }

  async detail(actor: Actor, id: string): Promise<AppointmentDetail> {
    const row = await this.loadRow(id);
    return toDetail(row, this.policy.abilitiesFor(actor, factsOf(row)));
  }

  async list(query: ListQuery): Promise<Page<AppointmentListItem>> {
    const where = this.whereFor(query);
    const [total, rows] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({
        where,
        include: appointmentListInclude,
        orderBy: [{ startsAt: query.from || query.to ? 'asc' : 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toListItem), total, page: query.page, pageSize: query.pageSize };
  }

  whereFor(query: Omit<ListQuery, 'page' | 'pageSize'>): Prisma.AppointmentWhereInput {
    const where: Prisma.AppointmentWhereInput = {};
    if (query.from || query.to) {
      where.startsAt = {
        ...(query.from ? { gte: fromJst(query.from) } : {}),
        ...(query.to ? { lt: fromJst(addDays(query.to, 1)) } : {}),
      };
    }
    if (query.bookedFrom || query.bookedTo) {
      where.bookedAt = {
        ...(query.bookedFrom ? { gte: fromJst(query.bookedFrom) } : {}),
        ...(query.bookedTo ? { lt: fromJst(addDays(query.bookedTo, 1)) } : {}),
      };
    }
    if (query.salesRepId) where.salesRepId = query.salesRepId;
    if (query.bookedById) where.bookedById = query.bookedById;
    if (query.companyId) where.companyId = query.companyId;
    if (query.status) where.status = query.status;
    if (query.listName) where.listName = { contains: query.listName, mode: 'insensitive' };
    if (query.q) {
      where.OR = [
        { company: { name: { contains: query.q, mode: 'insensitive' } } },
        { contactName: { contains: query.q, mode: 'insensitive' } },
        { company: { clientNo: query.q } },
      ];
    }
    return where;
  }

  /**
   * Day-before checks (spec §7): telemarketing appointments whose previous business day
   * is `checkDate` (on Friday: Saturday to Monday).
   */
  async dayBeforeList(
    checkDate?: string,
  ): Promise<{ checkDate: string; dates: string[]; items: AppointmentListItem[] }> {
    const today = checkDate ?? jstDate(this.clock.now());
    const calendar = await this.calendar.load(today, addDays(today, 14));
    const { first, last, dates } = calendar.checkWindow(today);
    const rows = await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.Scheduled,
        source: { not: AppointmentSource.SalesBooked },
        startsAt: { gte: fromJst(first), lt: fromJst(addDays(last, 1)) },
      },
      include: appointmentListInclude,
      orderBy: { startsAt: 'asc' },
    });
    return { checkDate: today, dates, items: rows.map(toListItem) };
  }

  async changeRequests(openOnly: boolean): Promise<ChangeRequestListItem[]> {
    const rows = await this.prisma.changeRequest.findMany({
      where: openOnly ? { status: { in: ['REQUESTED', 'IN_PROGRESS'] } } : {},
      include: {
        requestedBy: userRefSelect,
        handler: userRefSelect,
        appointment: { include: appointmentListInclude },
      },
      orderBy: { createdAt: openOnly ? 'asc' : 'desc' },
      take: 300,
    });
    return rows.map((row) => {
      const item = toListItem(row.appointment);
      return {
        ...toChangeRequestDto(row),
        appointment: {
          id: item.id,
          company: item.company,
          salesRep: item.salesRep,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          bookedBy: item.bookedBy,
        },
      };
    });
  }
}
