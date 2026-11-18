import { notificationQuerySchema, Permission } from '@telesales/shared';
import { Router } from 'express';
import { z } from 'zod';
import { currentUserOf } from '../../http/currentUser.js';
import type { Authenticator } from '../../http/middleware/Authenticator.js';
import { idParam, parseQuery, parseWith } from '../../http/validate.js';
import type { DashboardService } from '../dashboard/DashboardService.js';
import type { EmailService } from './EmailService.js';
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
  emails: EmailService;
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
  // Mails waiting for the signed-in person's confirmation (Sano 11/18): shown on the
  // 「メールの確認」 screen, sent only when they press 送信.
  router.get('/mail/pending', view, async (req, res) => {
    res.json(await deps.emails.pendingFor(currentUserOf(req).id));
  });
  router.post('/mail/pending/:id/send', view, async (req, res) => {
    res.json(await deps.emails.sendPending(currentUserOf(req), idParam(req)));
  });
  router.post('/mail/pending/:id/discard', view, async (req, res) => {
    await deps.emails.discardPending(currentUserOf(req), idParam(req));
    res.status(204).end();
  });
  router.get('/home', view, async (req, res) => {
    res.json(await deps.dashboard.home(currentUserOf(req)));
  });
  return router;
}
