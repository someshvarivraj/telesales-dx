import {
  jstDate,
  jstMinutesOfDay,
  type PlanDto,
  type ScheduleResponse,
  type SlotLockDto,
  type TimeOffDto,
  TimeOffKind,
} from '@telesales/shared';

export type EventKind =
  'appointment' | 'salesAppointment' | 'plan' | 'tentative' | 'attending' | 'timeoff' | 'lock';

export interface CalendarEvent {
  key: string;
  kind: EventKind;
  personId: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  title: string;
  plan?: PlanDto;
  timeOff?: TimeOffDto;
  lock?: SlotLockDto;
}

/** Colour per kind (spec §6: appointments, attendance and time off are colour-coded). */
export const EVENT_STYLE: Record<EventKind, { label: string; chip: string; dot: string }> = {
  appointment: {
    label: 'アポ（テレマ）',
    chip: 'border-l-4 border-calls bg-calls-soft text-ink',
    dot: 'bg-calls',
  },
  salesAppointment: {
    label: 'アポ（営業）',
    chip: 'border-l-4 border-calls/60 bg-calls-soft/70 text-ink',
    dot: 'bg-calls/60',
  },
  plan: {
    label: '予定',
    chip: 'border-l-4 border-schedule bg-schedule-soft text-ink',
    dot: 'bg-schedule',
  },
  tentative: {
    label: '仮予定',
    chip: 'border border-dashed border-schedule bg-surface text-ink',
    dot: 'border border-dashed border-schedule',
  },
  attending: {
    label: '同席',
    chip: 'border-l-4 border-success bg-success-soft text-ink',
    dot: 'bg-success',
  },
  timeoff: {
    label: '休み',
    chip: 'border-l-4 border-ink-sub bg-column text-ink-sub [background-image:repeating-linear-gradient(135deg,transparent_0_6px,rgb(0_0_0/0.04)_6px_12px)]',
    dot: 'bg-ink-sub',
  },
  lock: {
    label: '編集中',
    chip: 'border border-warning bg-warning-soft text-ink',
    dot: 'bg-warning',
  },
};

export function buildEvents(data: ScheduleResponse): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const plan of data.plans) {
    const kind: EventKind = plan.appointment
      ? plan.appointment.isTelema
        ? 'appointment'
        : 'salesAppointment'
      : plan.status === 'TENTATIVE'
        ? 'tentative'
        : 'plan';
    events.push({
      key: plan.id,
      kind,
      personId: plan.owner.id,
      startsAt: plan.startsAt,
      endsAt: plan.endsAt,
      allDay: plan.allDay,
      title: plan.title,
      plan,
    });
    for (const attendee of plan.attendees) {
      events.push({
        key: `${plan.id}:${attendee.id}`,
        kind: 'attending',
        personId: attendee.id,
        startsAt: plan.startsAt,
        endsAt: plan.endsAt,
        allDay: plan.allDay,
        title: `${plan.title}（${plan.owner.name}）`,
        plan,
      });
    }
  }
  for (const timeOff of data.timeOff) {
    events.push({
      key: timeOff.id,
      kind: 'timeoff',
      personId: timeOff.user.id,
      startsAt: timeOff.startsAt,
      endsAt: timeOff.endsAt,
      allDay: timeOff.allDay,
      // テレマアポ停止 reads as taken for the rep's own work (営業枠).
      title:
        timeOff.kind === TimeOffKind.TelemaStop
          ? `埋まり（営業枠）${timeOff.note ? `：${timeOff.note}` : ''}`
          : timeOff.note
            ? `休み：${timeOff.note}`
            : '休み',
      timeOff,
    });
  }
  for (const lock of data.locks) {
    if (!lock.isMine) {
      events.push({
        key: lock.id,
        kind: 'lock',
        personId: lock.salesRep.id,
        startsAt: lock.startsAt,
        endsAt: lock.endsAt,
        allDay: false,
        title: `${lock.lockedBy.name}さんが編集中`,
        lock,
      });
    }
  }
  return events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Events that touch a JST date. */
export function eventsOn(
  events: CalendarEvent[],
  date: string,
  personId?: string,
): CalendarEvent[] {
  return events.filter((event) => {
    if (personId && event.personId !== personId) return false;
    const first = jstDate(new Date(event.startsAt));
    const last = jstDate(new Date(new Date(event.endsAt).getTime() - 1));
    return first <= date && date <= last;
  });
}

/** Minutes from the start of the day grid, clamped to the day. */
export function minutesWithin(iso: string, date: string, edge: 'start' | 'end'): number {
  const instant = new Date(iso);
  const day = jstDate(instant);
  if (day < date) return 0;
  if (day > date) return 24 * 60;
  const minutes = jstMinutesOfDay(instant);
  return edge === 'end' && minutes === 0 ? 24 * 60 : minutes;
}
