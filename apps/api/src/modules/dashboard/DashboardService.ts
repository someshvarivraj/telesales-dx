import {
  addDays,
  AppointmentSource,
  AppointmentStatus,
  fromJst,
  type HomeSummaryResponse,
  jstDate,
  Permission,
} from '@telesales/shared';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import type { CalendarRepository } from '../../domain/calendar/CalendarRepository.js';
import type { Clock } from '../../domain/Clock.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { NextActionService } from '../appointments/NextActionService.js';
import type { AllocationService } from '../telema/AllocationService.js';

/** 今日やること: the per-person counts behind the home screen and the tabs' badges. */
export class DashboardService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly calendar: CalendarRepository,
    private readonly allocations: AllocationService,
    private readonly nextActions: NextActionService,
    private readonly clock: Clock,
  ) {}

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
      mine,
      allocationToConfirm,
      nextActionsDue,
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
      this.allocations.mine(actor.id, today),
      actor.can(Permission.ConfirmAllocation) || actor.can(Permission.Administer)
        ? this.allocations.needsConfirmation(today)
        : Promise.resolve(false),
      actor.can(Permission.WorkOnAppointments)
        ? this.nextActions.dueCount(actor.id)
        : Promise.resolve(0),
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
      myCalls: mine.calls,
      myDayBefore: mine.dayBefore,
      allocationToConfirm,
      nextActionsDue,
    };
  }

  private minDate(a: Date, b: Date): Date {
    return a < b ? a : b;
  }
}
