import {
  type AssistantActionKind,
  changeRequestRequestSchema,
  createAppointmentRequestSchema,
  createCallRecordRequestSchema,
  jstDate,
  planRequestSchema,
} from '@telesales/shared';
import { z } from 'zod';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import { parseWith } from '../../http/validate.js';
import type { AppointmentBookingService } from '../appointments/AppointmentBookingService.js';
import type { AppointmentWorkService } from '../appointments/AppointmentWorkService.js';
import type { CallRecordService } from '../callRecords/CallRecordService.js';
import type { ScheduleService } from '../schedule/ScheduleService.js';

export interface RunnerDeps {
  schedule: ScheduleService;
  callRecords: CallRecordService;
  work: AppointmentWorkService;
  booking: AppointmentBookingService;
}

const bodyOf = z.object({ body: z.unknown() });
const callResultPayload = z.object({ companyId: z.uuid(), body: z.unknown() });
const changePayload = z.object({ appointmentId: z.uuid() }).and(changeRequestRequestSchema);

/**
 * Runs a confirmed MoraBot card through the same services as the screens, as the person
 * who pressed 確定, so permissions, slot checks, notices and the audit log all apply.
 * Returns where the result can be seen.
 */
export class AssistantActionRunner {
  constructor(private readonly deps: RunnerDeps) {}

  async run(
    actor: Actor,
    action: { kind: AssistantActionKind; payload: unknown; link: string },
  ): Promise<string> {
    switch (action.kind) {
      case 'plan': {
        const input = parseWith(planRequestSchema, parseWith(bodyOf, action.payload).body);
        await this.deps.schedule.createPlan(actor, input);
        return `/schedule?date=${jstDate(new Date(input.startsAt))}`;
      }
      case 'callResult': {
        const { companyId, body } = parseWith(callResultPayload, action.payload);
        await this.deps.callRecords.create(
          actor,
          companyId,
          parseWith(createCallRecordRequestSchema, body),
        );
        return `/calls/companies/${companyId}`;
      }
      case 'changeRequest': {
        const { appointmentId, message } = parseWith(changePayload, action.payload);
        await this.deps.work.requestChange(actor, appointmentId, message);
        return `/appointments/${appointmentId}`;
      }
      case 'appointment': {
        const input = parseWith(
          createAppointmentRequestSchema,
          parseWith(bodyOf, action.payload).body,
        );
        const detail = await this.deps.booking.create(actor, input);
        return `/appointments/${detail.id}/mail/booking`;
      }
      case 'booking':
        // A slot hold happens on the booking screen, which 確定 opens.
        return action.link;
    }
  }
}
