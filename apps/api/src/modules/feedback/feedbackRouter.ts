import {
  createFeedbackRequestSchema,
  ErrorCode,
  feedbackQuerySchema,
  Permission,
  updateFeedbackRequestSchema,
} from '@telesales/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { currentUserOf } from '../../http/currentUser.js';
import type { Authenticator } from '../../http/middleware/Authenticator.js';
import { idParam, parseQuery, parseWith } from '../../http/validate.js';
import type { FeedbackService } from './FeedbackService.js';

/** ご意見・不具合の報告: send from any screen; admins list and update them. */
export function createFeedbackRouter(deps: {
  authenticator: Authenticator;
  feedback: FeedbackService;
}): Router {
  const router = Router();
  const view = deps.authenticator.requireAnyPermission(Permission.ViewData);
  const admin = deps.authenticator.requireAnyPermission(Permission.Administer);
  // Each report sends mail: a stuck button cannot flood everyone's inbox.
  const perUser = rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    keyGenerator: (req) => currentUserOf(req).id,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: ErrorCode.RateLimited } },
  });

  router.post('/feedback', view, perUser, async (req, res) => {
    res
      .status(201)
      .json(
        await deps.feedback.create(
          currentUserOf(req),
          parseWith(createFeedbackRequestSchema, req.body),
        ),
      );
  });
  router.get('/feedback/mine', view, async (req, res) => {
    res.json(await deps.feedback.mine(currentUserOf(req).id));
  });
  router.get('/admin/feedback', admin, async (req, res) => {
    res.json(await deps.feedback.list(parseQuery(feedbackQuerySchema, req).status));
  });
  router.put('/admin/feedback/:id', admin, async (req, res) => {
    res.json(
      await deps.feedback.update(
        currentUserOf(req),
        idParam(req),
        parseWith(updateFeedbackRequestSchema, req.body),
      ),
    );
  });
  return router;
}
