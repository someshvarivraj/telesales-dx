import {
  instantString,
  Permission,
  planRequestSchema,
  scheduleQuerySchema,
  slotLockRequestSchema,
  timeOffRequestSchema,
} from '@telesales/shared';
import { Router } from 'express';
import { z } from 'zod';
import { currentUserOf } from '../../http/currentUser.js';
import type { Authenticator } from '../../http/middleware/Authenticator.js';
import { idParam, parseQuery, parseWith } from '../../http/validate.js';
import type { ScheduleService } from './ScheduleService.js';
import type { SlotGuard } from './SlotGuard.js';

export interface ScheduleDeps {
  authenticator: Authenticator;
  schedule: ScheduleService;
  guard: SlotGuard;
}

const checkSchema = z.object({
  salesRepId: z.uuid(),
  startsAt: instantString,
  endsAt: instantString,
  kind: z.enum(['APPOINTMENT', 'PLAN']),
  appointmentId: z.uuid().nullish(),
  planId: z.uuid().nullish(),
  holidayWork: z.boolean().default(false),
});
const deleteQuery = z.object({ series: z.enum(['true', 'false']).default('false') });

/** ② Schedule: calendar data, plans, time off, slot locks. */
export function createScheduleRouter(deps: ScheduleDeps): Router {
  const router = Router();
  const auth = deps.authenticator;
  const view = auth.requireAnyPermission(Permission.ViewData);
  const writePlans = auth.requireAnyPermission(Permission.WriteSalesPlans, Permission.Administer);
  const writeTimeOff = auth.requireAnyPermission(
    Permission.WriteSalesPlans,
    Permission.WriteShifts,
    Permission.Administer,
  );
  const lockers = auth.requireAnyPermission(
    Permission.ManageTelemaAppointments,
    Permission.ManageSalesAppointments,
    Permission.Administer,
  );

  router.get('/schedule', view, async (req, res) => {
    const query = parseQuery(scheduleQuerySchema, req);
    res.json(
      await deps.schedule.getSchedule(currentUserOf(req), query.from, query.to, query.userIds),
    );
  });
  router.post('/schedule/check', view, async (req, res) => {
    const input = parseWith(checkSchema, req.body);
    res.json(
      await deps.schedule.checkSlot(currentUserOf(req), {
        ...input,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
      }),
    );
  });

  router.get('/plans/:id', view, async (req, res) => {
    res.json(await deps.schedule.getPlan(currentUserOf(req), idParam(req)));
  });
  router.post('/plans', writePlans, async (req, res) => {
    res
      .status(201)
      .json(
        await deps.schedule.createPlan(currentUserOf(req), parseWith(planRequestSchema, req.body)),
      );
  });
  router.put('/plans/:id', writePlans, async (req, res) => {
    res.json(
      await deps.schedule.updatePlan(
        currentUserOf(req),
        idParam(req),
        parseWith(planRequestSchema, req.body),
      ),
    );
  });
  router.delete('/plans/:id', writePlans, async (req, res) => {
    const { series } = parseQuery(deleteQuery, req);
    await deps.schedule.deletePlan(currentUserOf(req), idParam(req), series === 'true');
    res.status(204).end();
  });
  router.post('/plans/:id/confirm-candidate', writePlans, async (req, res) => {
    res.json(await deps.schedule.confirmCandidate(currentUserOf(req), idParam(req)));
  });

  router.post('/time-off', writeTimeOff, async (req, res) => {
    res
      .status(201)
      .json(
        await deps.schedule.createTimeOff(
          currentUserOf(req),
          parseWith(timeOffRequestSchema, req.body),
        ),
      );
  });
  router.delete('/time-off/:id', writeTimeOff, async (req, res) => {
    await deps.schedule.deleteTimeOff(currentUserOf(req), idParam(req));
    res.status(204).end();
  });

  router.post('/slot-locks', lockers, async (req, res) => {
    const input = parseWith(slotLockRequestSchema, req.body);
    res
      .status(201)
      .json(
        await deps.guard.acquireLock(
          currentUserOf(req).id,
          input.salesRepId,
          new Date(input.startsAt),
          new Date(input.endsAt),
        ),
      );
  });
  router.put('/slot-locks/:id', lockers, async (req, res) => {
    res.json(await deps.guard.heartbeat(currentUserOf(req).id, idParam(req)));
  });
  router.delete('/slot-locks/:id', lockers, async (req, res) => {
    await deps.guard.release(currentUserOf(req).id, idParam(req));
    res.status(204).end();
  });
  // Lets the browser release a lock while the page is closing (navigator.sendBeacon only POSTs).
  router.post('/slot-locks/:id/release', lockers, async (req, res) => {
    await deps.guard.release(currentUserOf(req).id, idParam(req));
    res.status(204).end();
  });
  return router;
}
