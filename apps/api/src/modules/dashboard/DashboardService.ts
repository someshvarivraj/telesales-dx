import {
  addDays,
  AppointmentSource,
  AppointmentStatus,
  type DashboardQuery,
  type DashboardResponse,
  fromJst,
  type HomeSummaryResponse,
  jstDate,
} from '@telesales/shared';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import type { CalendarRepository } from '../../domain/calendar/CalendarRepository.js';
import type { Clock } from '../../domain/Clock.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { ValidationError } from '../../http/errors/AppError.js';

type Query = Required<Pick<DashboardQuery, 'from' | 'to'>> & Omit<DashboardQuery, 'from' | 'to'>;

/**
 * Basic dashboard (spec §6): calls, appointments, rate and meeting status, filtered by
 * period, person and list. Cancelled appointments are not counted, so re-bookings count once.
 */
export class DashboardService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly calendar: CalendarRepository,
    private readonly clock: Clock,
  ) {}

  async summary(query: Query): Promise<DashboardResponse> {
    if (query.to < query.from || addDays(query.from, 400) < query.to) {
      throw new ValidationError({ to: ['invalid_range'] });
    }
    const start = fromJst(query.from);
    const end = fromJst(addDays(query.to, 1));

    const callWhere: Prisma.CallRecordWhereInput = {
      calledAt: { gte: start, lt: end },
      ...(query.telemarketerId ? { telemarketerId: query.telemarketerId } : {}),
      ...(query.listName ? { company: { listName: query.listName } } : {}),
    };
    const bookedWhere: Prisma.AppointmentWhereInput = {
      bookedAt: { gte: start, lt: end },
      status: { not: AppointmentStatus.Cancelled },
      ...(query.telemarketerId ? { bookedById: query.telemarketerId } : {}),
      ...(query.salesRepId ? { salesRepId: query.salesRepId } : {}),
      ...(query.listName ? { listName: query.listName } : {}),
    };
    const meetingWhere: Prisma.AppointmentWhereInput = {
      startsAt: { gte: start, lt: end },
      ...(query.telemarketerId ? { bookedById: query.telemarketerId } : {}),
      ...(query.salesRepId ? { salesRepId: query.salesRepId } : {}),
      ...(query.listName ? { listName: query.listName } : {}),
    };

    const [
      calls,
      appointments,
      fromCalls,
      meetingStatus,
      awaitingResult,
      callsByPerson,
      bookedByPerson,
      byRep,
      completedByRep,
      byGrade,
      bookedByList,
      callsByCompanyList,
    ] = await Promise.all([
      this.prisma.callRecord.count({ where: callWhere }),
      this.prisma.appointment.count({ where: bookedWhere }),
      this.prisma.appointment.count({
        where: { ...bookedWhere, source: AppointmentSource.CallStatus },
      }),
      this.prisma.appointment.groupBy({
        by: ['status'],
        where: meetingWhere,
        _count: { _all: true },
      }),
      this.prisma.appointment.count({
        where: {
          ...meetingWhere,
          status: AppointmentStatus.Scheduled,
          startsAt: { gte: start, lt: this.minDate(end, this.clock.now()) },
        },
      }),
      this.prisma.callRecord.groupBy({
        by: ['telemarketerId'],
        where: callWhere,
        _count: { _all: true },
      }),
      this.prisma.appointment.groupBy({
        by: ['bookedById'],
        where: bookedWhere,
        _count: { _all: true },
      }),
      this.prisma.appointment.groupBy({
        by: ['salesRepId'],
        where: bookedWhere,
        _count: { _all: true },
      }),
      this.prisma.appointment.groupBy({
        by: ['salesRepId'],
        where: { ...meetingWhere, status: AppointmentStatus.Completed },
        _count: { _all: true },
      }),
      this.prisma.callRecord.groupBy({ by: ['grade'], where: callWhere, _count: { _all: true } }),
      this.prisma.appointment.groupBy({
        by: ['listName'],
        where: bookedWhere,
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<{ list_name: string | null; count: bigint }[]>`
        SELECT c.list_name, COUNT(*)::bigint AS count
        FROM call_records r JOIN companies c ON c.id = r.company_id
        WHERE r.called_at >= ${start} AND r.called_at < ${end}
        GROUP BY c.list_name`,
    ]);

    const userIds = new Set<string>([
      ...callsByPerson.map((row) => row.telemarketerId),
      ...bookedByPerson.map((row) => row.bookedById),
      ...byRep.map((row) => row.salesRepId),
    ]);
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, name: true },
    });
    const nameOf = new Map(users.map((user) => [user.id, user.name]));
    const ref = (id: string) => ({ id, name: nameOf.get(id) ?? '' });

    const telemarketers = new Map<string, { calls: number; appointments: number }>();
    callsByPerson.forEach((row) =>
      telemarketers.set(row.telemarketerId, { calls: row._count._all, appointments: 0 }),
    );
    bookedByPerson.forEach((row) => {
      const entry = telemarketers.get(row.bookedById) ?? { calls: 0, appointments: 0 };
      entry.appointments = row._count._all;
      telemarketers.set(row.bookedById, entry);
    });

    const lists = new Map<string, { calls: number; appointments: number }>();
    callsByCompanyList.forEach((row) =>
      lists.set(row.list_name ?? '（リスト名なし）', { calls: Number(row.count), appointments: 0 }),
    );
    bookedByList.forEach((row) => {
      const key = row.listName ?? '（リスト名なし）';
      const entry = lists.get(key) ?? { calls: 0, appointments: 0 };
      entry.appointments = row._count._all;
      lists.set(key, entry);
    });

    const status = (value: AppointmentStatus) =>
      meetingStatus.find((row) => row.status === value)?._count._all ?? 0;
    return {
      from: query.from,
      to: query.to,
      calls,
      appointments,
      appointmentRate: calls > 0 ? fromCalls / calls : null,
      meetings: {
        scheduled: status(AppointmentStatus.Scheduled),
        completed: status(AppointmentStatus.Completed),
        cancelled: status(AppointmentStatus.Cancelled),
        awaitingResult,
      },
      byTelemarketer: [...telemarketers.entries()]
        .map(([id, counts]) => ({ user: ref(id), ...counts }))
        .sort((a, b) => b.appointments - a.appointments || b.calls - a.calls),
      bySalesRep: byRep
        .map((row) => ({
          user: ref(row.salesRepId),
          appointments: row._count._all,
          completed:
            completedByRep.find((done) => done.salesRepId === row.salesRepId)?._count._all ?? 0,
        }))
        .sort((a, b) => b.appointments - a.appointments),
      byList: [...lists.entries()]
        .map(([listName, counts]) => ({ listName, ...counts }))
        .sort((a, b) => b.appointments - a.appointments || b.calls - a.calls),
      byGrade: byGrade
        .map((row) => ({ grade: row.grade, count: row._count._all }))
        .sort((a, b) => a.grade.localeCompare(b.grade)),
    };
  }

  /** The numbers on the home screen: what needs this person's attention today. */
  async home(actor: Actor): Promise<HomeSummaryResponse> {
    const now = this.clock.now();
    const today = jstDate(now);
    const calendar = await this.calendar.load(today, addDays(today, 14));
    const window = calendar.checkWindow(today);
    const [
      todayPlans,
      unconfirmed,
      missingResults,
      openChangeRequests,
      dayBeforePending,
      newCallLists,
      duplicates,
    ] = await Promise.all([
      this.prisma.schedulePlan.count({
        where: {
          deletedAt: null,
          startsAt: { lt: fromJst(addDays(today, 1)) },
          endsAt: { gt: fromJst(today) },
          OR: [{ ownerId: actor.id }, { attendees: { some: { userId: actor.id } } }],
        },
      }),
      this.prisma.appointment.count({
        where: {
          salesRepId: actor.id,
          status: AppointmentStatus.Scheduled,
          salesConfirmedAt: null,
          startsAt: { gte: now },
        },
      }),
      this.prisma.appointment.count({
        where: { salesRepId: actor.id, status: AppointmentStatus.Scheduled, startsAt: { lt: now } },
      }),
      this.prisma.changeRequest.count({ where: { status: 'REQUESTED' } }),
      this.prisma.appointment.count({
        where: {
          status: AppointmentStatus.Scheduled,
          source: { not: AppointmentSource.SalesBooked },
          dayBeforeResult: null,
          startsAt: { gte: fromJst(window.first), lt: fromJst(addDays(window.last, 1)) },
        },
      }),
      this.prisma.listImport.count({
        where: { purpose: 'CALL_REQUEST', createdAt: { gte: fromJst(addDays(today, -7)) } },
      }),
      this.prisma.company.count({ where: { flag: { not: 'NONE' } } }),
    ]);
    return {
      todayPlans,
      unconfirmedAppointments: unconfirmed,
      missingResults,
      openChangeRequests,
      dayBeforePending,
      dayBeforeDate: window.first,
      newCallLists,
      duplicatesToResolve: duplicates,
    };
  }

  private minDate(a: Date, b: Date): Date {
    return a < b ? a : b;
  }
}
