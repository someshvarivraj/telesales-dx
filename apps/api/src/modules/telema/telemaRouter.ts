import {
  allocationDateQuerySchema,
  allocationMoveRequestSchema,
  dateString,
  fillShiftsRequestSchema,
  Permission,
  shiftMonthQuerySchema,
  shiftRequestSchema,
  telemarketerRequestSchema,
  usualHoursRequestSchema,
} from '@telesales/shared';
import { Router } from 'express';
import { z } from 'zod';
import { currentUserOf } from '../../http/currentUser.js';
import type { Authenticator } from '../../http/middleware/Authenticator.js';
import { idParam, parseQuery, parseWith } from '../../http/validate.js';
import type { AllocationService } from './AllocationService.js';
import type { TelemaService } from './TelemaService.js';

export interface TelemaDeps {
  authenticator: Authenticator;
  team: TelemaService;
  allocations: AllocationService;
}

const optionalDateQuery = z.object({ date: dateString.optional() });
const dateBody = z.object({ date: dateString });
const moveBody = allocationMoveRequestSchema.extend({ date: dateString });

/** ② Telemarketing (priority 2): telemarketer info, shifts, today's staff, auto allocation. */
export function createTelemaRouter(deps: TelemaDeps): Router {
  const router = Router();
  const auth = deps.authenticator;
  const view = auth.requireAnyPermission(Permission.ViewData);
  const writeShifts = auth.requireAnyPermission(
    Permission.WriteShifts,
    Permission.ConfirmAllocation,
    Permission.Administer,
  );
  const manage = auth.requireAnyPermission(Permission.ConfirmAllocation, Permission.Administer);

  router.get('/telema/people', view, async (_req, res) => {
    res.json(await deps.team.telemarketers());
  });
  router.put('/telema/people/:id', manage, async (req, res) => {
    const input = parseWith(telemarketerRequestSchema, req.body);
    res.json(await deps.team.updateTelemarketer(currentUserOf(req), idParam(req), input));
  });
  router.put('/telema/me/usual-hours', writeShifts, async (req, res) => {
    const input = parseWith(usualHoursRequestSchema, req.body);
    res.json(await deps.team.updateOwnUsualHours(currentUserOf(req), input));
  });

  router.get('/telema/shifts', view, async (req, res) => {
    const { month } = parseQuery(shiftMonthQuerySchema, req);
    res.json(await deps.team.shiftMonth(month));
  });
  router.put('/telema/shifts', writeShifts, async (req, res) => {
    res.json(
      await deps.team.saveShift(currentUserOf(req), parseWith(shiftRequestSchema, req.body)),
    );
  });
  router.delete('/telema/shifts/:id', writeShifts, async (req, res) => {
    await deps.team.deleteShift(currentUserOf(req), idParam(req));
    res.status(204).end();
  });
  router.post('/telema/shifts/fill', writeShifts, async (req, res) => {
    const input = parseWith(fillShiftsRequestSchema, req.body);
    res.json(await deps.team.fillMonth(currentUserOf(req), input.month, input.userIds));
  });
  router.get('/telema/staff', view, async (req, res) => {
    const { date } = parseQuery(optionalDateQuery, req);
    res.json(await deps.team.staffOn(date));
  });

  router.get('/telema/allocations', view, async (req, res) => {
    const { date } = parseQuery(allocationDateQuerySchema, req);
    res.json(await deps.allocations.day(currentUserOf(req), date));
  });
  router.get('/telema/allocations/mine', view, async (req, res) => {
    res.json(await deps.allocations.mine(currentUserOf(req).id));
  });
  router.post('/telema/allocations/calculate', manage, async (req, res) => {
    const { date } = parseWith(dateBody, req.body);
    res.json(await deps.allocations.calculate(currentUserOf(req), date));
  });
  router.post('/telema/allocations/move', manage, async (req, res) => {
    const input = parseWith(moveBody, req.body);
    await deps.allocations.move(currentUserOf(req), input.date, input.ids, input.assigneeId);
    res.status(204).end();
  });
  router.post('/telema/allocations/confirm', manage, async (req, res) => {
    const { date } = parseWith(dateBody, req.body);
    await deps.allocations.confirm(currentUserOf(req), date);
    res.status(204).end();
  });
  return router;
}
