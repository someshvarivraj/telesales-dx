import type { SystemStatusResponse } from '@telesales/shared';
import { Router } from 'express';
import type { SettingsService } from '../settings/SettingsService.js';
import type { AppService } from './AppService.js';

/**
 * Mounted first among the signed-in routes: the status check stays reachable during
 * maintenance (so the web app can show the notice), everything after it is gated.
 */
/** Before login: the login screen announces downtime too. */
export function createPublicNoticeRouter(settings: SettingsService): Router {
  const router = Router();
  router.get('/system/planned-outage', async (_req, res) => {
    res.json(await settings.plannedOutage());
  });
  return router;
}

export function createSystemRouter(apps: AppService, settings: SettingsService): Router {
  const router = Router();
  router.get('/system/status', async (_req, res) => {
    const body: SystemStatusResponse = {
      maintenance: await apps.inMaintenance(),
      plannedOutage: await settings.plannedOutage(),
    };
    res.json(body);
  });
  router.use(apps.gate());
  return router;
}
