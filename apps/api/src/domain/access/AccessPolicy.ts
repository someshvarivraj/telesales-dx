import type { AppointmentSource } from '@telesales/shared';
import {
  type AppointmentAbilities,
  AppointmentStatus,
  isTelemaSource,
  Permission,
  Role,
} from '@telesales/shared';

/** The parts of a user the rules need. `User` satisfies it; tests can pass plain objects. */
export interface Actor {
  readonly id: string;
  can(permission: Permission): boolean;
  hasRole(role: Role): boolean;
}

export interface AppointmentFacts {
  source: AppointmentSource;
  status: AppointmentStatus;
  salesRepId: string;
  bookedById: string;
  attendeeIds: readonly string[];
  hasOpenChangeRequest: boolean;
}

export interface PlanFacts {
  ownerId: string;
  appointmentId: string | null;
}

/**
 * Row-level rules on top of the role permissions (spec §4 and §7).
 * Route guards check the permission; services ask this policy about the specific record.
 */
export class AccessPolicy {
  isAdmin(actor: Actor): boolean {
    return actor.can(Permission.Administer);
  }

  /** Telemarketers edit their own call records; leads and admins edit any (spec §4). */
  canEditCallRecord(actor: Actor, record: { telemarketerId: string }): boolean {
    if (!actor.can(Permission.WriteCallRecords)) {
      return false;
    }
    return (
      record.telemarketerId === actor.id || actor.hasRole(Role.TelemaLead) || this.isAdmin(actor)
    );
  }

  /** Sales work on appointments they are assigned to or attend; admins on all. */
  isAssignedOrAttending(actor: Actor, appointment: AppointmentFacts): boolean {
    return appointment.salesRepId === actor.id || appointment.attendeeIds.includes(actor.id);
  }

  canWorkOnAppointment(actor: Actor, appointment: AppointmentFacts): boolean {
    if (this.isAdmin(actor)) {
      return true;
    }
    return (
      actor.can(Permission.WorkOnAppointments) && this.isAssignedOrAttending(actor, appointment)
    );
  }

  /**
   * Telemarketing appointments are moved by any telemarketer (spec §7).
   * Sales-booked appointments are changed by sales. Admins can do both.
   */
  canReschedule(actor: Actor, appointment: AppointmentFacts): boolean {
    if (appointment.status !== AppointmentStatus.Scheduled) {
      return false;
    }
    return this.canManage(actor, appointment.source);
  }

  canManage(actor: Actor, source: AppointmentSource): boolean {
    if (this.isAdmin(actor)) {
      return true;
    }
    return isTelemaSource(source)
      ? actor.can(Permission.ManageTelemaAppointments)
      : actor.can(Permission.ManageSalesAppointments);
  }

  canBook(actor: Actor, source: AppointmentSource): boolean {
    return this.canManage(actor, source);
  }

  abilitiesFor(actor: Actor, appointment: AppointmentFacts): AppointmentAbilities {
    const scheduled = appointment.status === AppointmentStatus.Scheduled;
    const cancelled = appointment.status === AppointmentStatus.Cancelled;
    const work = this.canWorkOnAppointment(actor, appointment);
    const manage = this.canManage(actor, appointment.source);
    const telema = isTelemaSource(appointment.source);
    return {
      confirm: work && scheduled,
      editMeetingUrl: work && !cancelled,
      addPreparation: work && !cancelled,
      addResult: work && !cancelled,
      requestChange:
        telema &&
        scheduled &&
        !appointment.hasOpenChangeRequest &&
        (actor.can(Permission.SendChangeRequests) || this.isAdmin(actor)),
      reschedule: manage && scheduled,
      cancel: manage && scheduled,
      rebook: manage && cancelled,
      editDetails: manage && !cancelled,
      dayBeforeCheck: telema && scheduled && actor.can(Permission.WriteDayBeforeChecks),
      sendBookingMail: manage && !cancelled,
      comment: actor.can(Permission.WriteComments),
    };
  }

  /**
   * Sales add and change their own and other reps' plans (not appointments).
   * Plans that are appointments are only moved through the appointment.
   */
  canEditPlan(actor: Actor, plan: PlanFacts): boolean {
    if (plan.appointmentId) {
      return false;
    }
    if (this.isAdmin(actor)) {
      return true;
    }
    return actor.can(Permission.WriteSalesPlans);
  }

  /** Time off: sales for any rep; telemarketers for themselves and absences they were told about. */
  canEditTimeOff(actor: Actor): boolean {
    return (
      this.isAdmin(actor) ||
      actor.can(Permission.WriteSalesPlans) ||
      actor.can(Permission.WriteShifts)
    );
  }
}
