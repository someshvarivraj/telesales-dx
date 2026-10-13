import type { ChangePasswordRequest, LoginRequest, SessionResponse } from '@telesales/shared';
import type { Request, Response } from 'express';
import type { Clock } from '../../domain/Clock.js';
import { UnauthenticatedError } from '../../http/errors/AppError.js';
import { destroySession, regenerateSession } from '../../http/middleware/Authenticator.js';
import { requestContextOf } from '../../http/requestContext.js';
import { SESSION_COOKIE_NAME } from '../../infrastructure/session/createSessionMiddleware.js';
import type { AuthService } from './AuthService.js';

type NoParams = Record<string, never>;

export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly clock: Clock,
  ) {}

  login = async (
    req: Request<NoParams, SessionResponse, LoginRequest>,
    res: Response<SessionResponse>,
  ) => {
    const { email, password } = req.body;
    const user = await this.auth.login(email, password, requestContextOf(req));

    // New session id on login prevents session fixation.
    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.authenticatedAt = this.clock.now().getTime();

    res.status(200).json({ user: user.toSessionUser() });
  };

  me = (req: Request, res: Response<SessionResponse>) => {
    const user = req.currentUser;
    if (!user) {
      throw new UnauthenticatedError();
    }
    res.json({ user: user.toSessionUser() });
  };

  logout = async (req: Request, res: Response) => {
    const userId = req.session.userId;
    await destroySession(req);
    res.clearCookie(SESSION_COOKIE_NAME);
    if (userId) {
      await this.auth.recordLogout(userId, requestContextOf(req));
    }
    res.status(204).end();
  };

  changePassword = async (
    req: Request<NoParams, SessionResponse, ChangePasswordRequest>,
    res: Response<SessionResponse>,
  ) => {
    const user = req.currentUser;
    if (!user) {
      throw new UnauthenticatedError();
    }
    await this.auth.changePassword(
      user,
      req.body.currentPassword,
      req.body.newPassword,
      requestContextOf(req),
    );

    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.authenticatedAt = this.clock.now().getTime();

    res.json({ user: user.toSessionUser() });
  };
}
