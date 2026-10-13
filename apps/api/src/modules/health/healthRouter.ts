import { Router } from 'express';

export interface HealthCheck {
  isHealthy(): Promise<boolean>;
}

/** Liveness (process up) and readiness (database reachable) for the load balancer. */
export function createHealthRouter(database: HealthCheck): Router {
  const router = Router();

  router.get('/live', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/ready', async (_req, res) => {
    const ok = await database.isHealthy();
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'unavailable' });
  });

  return router;
}
