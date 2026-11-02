import { changePasswordRequestSchema, ErrorCode, loginRequestSchema } from '@telesales/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Authenticator } from '../../http/middleware/Authenticator.js';
import { validateBody } from '../../http/middleware/validateBody.js';
import type { AuthController } from './AuthController.js';

export function createAuthRouter(controller: AuthController, authenticator: Authenticator): Router {
  const router = Router();

  // Per-IP limit in addition to per-account lockout.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: ErrorCode.RateLimited } },
  });

  router.post('/login', loginLimiter, validateBody(loginRequestSchema), controller.login);
  router.post('/logout', controller.logout);
  router.get('/me', authenticator.requireAuth({ allowPendingPasswordChange: true }), controller.me);
  router.post(
    '/extend',
    authenticator.requireAuth({ allowPendingPasswordChange: true }),
    (req, res) => {
      res.json({ expiresAt: authenticator.extend(req, res) });
    },
  );
  router.post(
    '/password',
    authenticator.requireAuth({ allowPendingPasswordChange: true }),
    validateBody(changePasswordRequestSchema),
    controller.changePassword,
  );

  return router;
}
