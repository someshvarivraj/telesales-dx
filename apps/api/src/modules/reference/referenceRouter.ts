import { isRole, Permission } from '@telesales/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { Authenticator } from '../../http/middleware/Authenticator.js';
import { parseQuery } from '../../http/validate.js';
import type { AdminUserService } from '../admin/AdminUserService.js';
import type { CalendarService } from '../calendar/CalendarService.js';
import type { OptionService } from '../options/OptionService.js';
import type { SettingsService } from '../settings/SettingsService.js';
import { dateString } from '@telesales/shared';

export interface ReferenceDeps {
  authenticator: Authenticator;
  options: OptionService;
  users: AdminUserService;
  calendar: CalendarService;
  settings: SettingsService;
}

const peopleQuery = z.object({
  role: z
    .string()
    .optional()
    .refine((v) => v === undefined || isRole(v)),
});
const rangeQuery = z.object({ from: dateString, to: dateString });

/** Lookups every signed-in user needs: option lists, people for pickers, holidays. */
export function createReferenceRouter(deps: ReferenceDeps): Router {
  const router = Router();
  const view = deps.authenticator.requireAnyPermission(Permission.ViewData);

  router.get('/options', view, async (_req, res) => {
    res.json(await deps.options.list(false));
  });
  router.get('/people', view, async (req, res) => {
    const { role } = parseQuery(peopleQuery, req);
    res.json(await deps.users.people(role && isRole(role) ? role : undefined));
  });
  router.get('/calendar', view, async (req, res) => {
    const { from, to } = parseQuery(rangeQuery, req);
    res.json(await deps.calendar.listRange(from, to));
  });
  router.get('/settings', view, async (_req, res) => {
    res.json(await deps.settings.get());
  });
  return router;
}
