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
      // A rep's own appointment needs no 営業さんへの伝達事項 mail (request 11/17).
      sendBookingMail: manage && !cancelled && telema,
      comment: actor.can(Permission.WriteComments),
    };
  }

  /** May write plans at all: sales (and anyone granted it) and admins. */
  canWritePlans(actor: Actor): boolean {
    return this.isAdmin(actor) || actor.can(Permission.WriteSalesPlans);
  }

  /**
   * Whose calendar a plan may go on (11/18): a rep puts plans only on their own calendar; other
   * reps join it as 同席者. Admins anywhere.
   */
  canPlacePlan(actor: Actor, ownerId: string): boolean {
    if (this.isAdmin(actor)) return true;
    return actor.can(Permission.WriteSalesPlans) && ownerId === actor.id;
  }

  /**
   * Changing or deleting a plan (11/18: own plans only): the rep whose plan it is, or an admin.
   * Being 同席者 on someone's plan does not make it yours to change. Plans that are appointments
   * are only moved through the appointment.
   */
  canEditPlan(actor: Actor, plan: PlanFacts): boolean {
    if (plan.appointmentId) {
      return false;
    }
    if (this.isAdmin(actor)) {
      return true;
    }
    return actor.can(Permission.WriteSalesPlans) && plan.ownerId === actor.id;
  }

  /** Confirming a 仮予定 (11/13): the rep whose plan it is, or an admin. */
  canConfirmPlan(actor: Actor, plan: PlanFacts): boolean {
    if (this.isAdmin(actor)) {
      return true;
    }
    if (plan.appointmentId) {
      return plan.ownerId === actor.id;
    }
    return plan.ownerId === actor.id && actor.can(Permission.WriteSalesPlans);
  }

  /** Time off: sales for any rep; telemarketers for themselves and absences they were told about. */
  canEditTimeOff(actor: Actor): boolean {
    return (
      this.isAdmin(actor) ||
      actor.can(Permission.WriteSalesPlans) ||
      actor.can(Permission.WriteShifts)
    );
  }

  /** Leads and admins run the team: everyone's shifts, allocation and telemarketer info. */
  managesTelema(actor: Actor): boolean {
    return this.isAdmin(actor) || actor.can(Permission.ConfirmAllocation);
  }

  /**
   * Shifts (spec §4): a telemarketer edits their own month, and someone else's from today
   * on when that person calls in (late, early leave, absence). Leads and admins edit any.
   */
  canEditShift(actor: Actor, ownerId: string, date: string, today: string): boolean {
    if (this.managesTelema(actor)) {
      return true;
    }
    if (!actor.can(Permission.WriteShifts)) {
      return false;
    }
    return ownerId === actor.id || date >= today;
  }
}
