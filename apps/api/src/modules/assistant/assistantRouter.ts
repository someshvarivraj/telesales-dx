import { ErrorCode, operatorRoleLabel, Permission } from '@telesales/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { currentUserOf } from '../../http/currentUser.js';
import type { Authenticator } from '../../http/middleware/Authenticator.js';
import { parseWith } from '../../http/validate.js';
import type { AssistantService } from './AssistantService.js';

const chatBody = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20)
    .refine((turns) => turns.at(-1)?.role === 'user', 'last_turn_must_be_user'),
});

/** MoraBot chat: answers how-to questions and looks things up as the signed-in user. */
export function createAssistantRouter(deps: {
  authenticator: Authenticator;
  assistant: AssistantService;
}): Router {
  const router = Router();
  const view = deps.authenticator.requireAnyPermission(Permission.ViewData);
  // Per person: keeps a runaway loop or a stuck key from spending the AI budget.
  const perUser = rateLimit({
    windowMs: 15 * 60_000,
    limit: 40,
    keyGenerator: (req) => currentUserOf(req).id,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: ErrorCode.RateLimited } },
  });

  router.get('/assistant/status', view, (_req, res) => {
    res.json({ enabled: deps.assistant.enabled });
  });
  router.post('/assistant/chat', view, perUser, async (req, res) => {
    const body = parseWith(chatBody, req.body);
    const user = currentUserOf(req);
    res.json(
      await deps.assistant.chat(
        user,
        { name: user.name, roleLabel: operatorRoleLabel(user.roles) },
        body.messages,
      ),
    );
  });
  return router;
}
