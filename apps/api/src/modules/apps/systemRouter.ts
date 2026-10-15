import type { SystemStatusResponse } from '@telesales/shared';
import { Router } from 'express';
import type { AppService } from './AppService.js';

/**
 * Mounted first among the signed-in routes: the status check stays reachable during
 * maintenance (so the web app can show the notice), everything after it is gated.
 */
export function createSystemRouter(apps: AppService): Router {
  const router = Router();
  router.get('/system/status', async (_req, res) => {
    const body: SystemStatusResponse = { maintenance: await apps.inMaintenance() };
    res.json(body);
  });
  router.use(apps.gate());
  return router;
}
