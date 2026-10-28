import {
  type AssistantStreamEvent,
  assistantChatRequestSchema,
  ErrorCode,
  operatorRoleLabel,
  Permission,
} from '@telesales/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Logger } from 'pino';
import { currentUserOf } from '../../http/currentUser.js';
import { AppError, hasDetails } from '../../http/errors/AppError.js';
import type { Authenticator } from '../../http/middleware/Authenticator.js';
import { idParam, parseWith } from '../../http/validate.js';
import type { AssistantConversations } from './AssistantConversations.js';
import type { AssistantService } from './AssistantService.js';

/**
 * MoraBot: chat (streamed, so people see each step), history, and the 確定 / やめる of
 * its proposal cards. Everything is the signed-in person's own.
 */
export function createAssistantRouter(deps: {
  authenticator: Authenticator;
  assistant: AssistantService;
  conversations: AssistantConversations;
  logger: Logger;
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

  router.get('/assistant/conversations', view, async (req, res) => {
    res.json(await deps.conversations.list(currentUserOf(req).id));
  });
  router.get('/assistant/conversations/:id', view, async (req, res) => {
    res.json(await deps.conversations.get(currentUserOf(req).id, idParam(req)));
  });
  router.delete('/assistant/conversations/:id', view, async (req, res) => {
    await deps.conversations.remove(currentUserOf(req).id, idParam(req));
    res.status(204).end();
  });
  router.get('/assistant/actions', view, async (req, res) => {
    res.json(await deps.conversations.actions(currentUserOf(req).id));
  });
  router.post('/assistant/actions/:id/confirm', view, async (req, res) => {
    res.json(await deps.conversations.decide(currentUserOf(req), idParam(req), 'confirm'));
  });
  router.post('/assistant/actions/:id/dismiss', view, async (req, res) => {
    res.json(await deps.conversations.decide(currentUserOf(req), idParam(req), 'dismiss'));
  });

  // One JSON object per line: the conversation, each step as it finishes, then the answer.
  router.post('/assistant/chat', view, perUser, async (req, res) => {
    const body = parseWith(assistantChatRequestSchema, req.body);
    const user = currentUserOf(req);
    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    // nginx in front of staging: pass each line on as soon as it is written.
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const emit = (event: AssistantStreamEvent) => res.write(`${JSON.stringify(event)}\n`);
    try {
      await deps.conversations.chat(
        user,
        { name: user.name, roleLabel: operatorRoleLabel(user.roles) },
        body,
        emit,
      );
    } catch (error: unknown) {
      if (!(error instanceof AppError)) {
        deps.logger.error({ err: error }, 'assistant chat failed');
      }
      const reason =
        error instanceof AppError && hasDetails(error)
          ? (error.details as { reason?: string } | undefined)?.reason
          : undefined;
      emit({
        type: 'error',
        code: error instanceof AppError ? error.code : ErrorCode.Internal,
        ...(reason ? { reason } : {}),
      });
    }
    res.end();
  });
  return router;
}
