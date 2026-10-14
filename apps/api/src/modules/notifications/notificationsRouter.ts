import { dashboardQuerySchema, Permission } from '@telesales/shared';
import { Router } from 'express';
import { z } from 'zod';
import { currentUserOf } from '../../http/currentUser.js';
import type { Authenticator } from '../../http/middleware/Authenticator.js';
import { parseQuery, parseWith } from '../../http/validate.js';
import type { DashboardService } from '../dashboard/DashboardService.js';
import type { NotificationService } from './NotificationService.js';

const readBody = z.object({ ids: z.union([z.literal('all'), z.array(z.uuid()).max(200)]) });

export function createNotificationsRouter(deps: {
  authenticator: Authenticator;
  notifications: NotificationService;
  dashboard: DashboardService;
}): Router {
  const router = Router();
  const view = deps.authenticator.requireAnyPermission(Permission.ViewData);

  router.get('/notifications', async (req, res) => {
    res.json(await deps.notifications.listFor(currentUserOf(req).id));
  });
  router.post('/notifications/read', async (req, res) => {
    await deps.notifications.markRead(currentUserOf(req).id, parseWith(readBody, req.body).ids);
    res.status(204).end();
  });
  router.get('/home', view, async (req, res) => {
    res.json(await deps.dashboard.home(currentUserOf(req)));
  });
  router.get('/dashboard', view, async (req, res) => {
    const query = parseQuery(dashboardQuerySchema, req);
    res.json(await deps.dashboard.summary(query));
  });
  return router;
}
