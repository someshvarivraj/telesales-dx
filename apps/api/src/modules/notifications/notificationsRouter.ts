import { notificationQuerySchema, Permission } from '@telesales/shared';
import { Router } from 'express';
import { z } from 'zod';
import { currentUserOf } from '../../http/currentUser.js';
import type { Authenticator } from '../../http/middleware/Authenticator.js';
import { parseQuery, parseWith } from '../../http/validate.js';
import type { DashboardService } from '../dashboard/DashboardService.js';
import type { NotificationService } from './NotificationService.js';

const readBody = z.object({ ids: z.union([z.literal('all'), z.array(z.uuid()).max(200)]) });
const idsBody = z.object({ ids: z.array(z.uuid()).min(1).max(200) });
const archiveBody = z.object({
  ids: z.union([z.literal('read'), z.array(z.uuid()).min(1).max(200)]),
  archived: z.boolean().default(true),
});

export function createNotificationsRouter(deps: {
  authenticator: Authenticator;
  notifications: NotificationService;
  dashboard: DashboardService;
}): Router {
  const router = Router();
  const view = deps.authenticator.requireAnyPermission(Permission.ViewData);

  router.get('/notifications', async (req, res) => {
    const query = parseQuery(notificationQuerySchema, req);
    res.json(await deps.notifications.listFor(currentUserOf(req).id, query));
  });
  router.post('/notifications/unread', async (req, res) => {
    await deps.notifications.markUnread(currentUserOf(req).id, parseWith(idsBody, req.body).ids);
    res.status(204).end();
  });
  router.post('/notifications/archive', async (req, res) => {
    const body = parseWith(archiveBody, req.body);
    await deps.notifications.setArchived(currentUserOf(req).id, body.ids, body.archived);
    res.status(204).end();
  });
  router.post('/notifications/read', async (req, res) => {
    await deps.notifications.markRead(currentUserOf(req).id, parseWith(readBody, req.body).ids);
    res.status(204).end();
  });
  router.get('/home', view, async (req, res) => {
    res.json(await deps.dashboard.home(currentUserOf(req)));
  });
  return router;
}
