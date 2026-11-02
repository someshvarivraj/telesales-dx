import { type Permission, SESSION_EXPIRES_HEADER } from '@telesales/shared';
import type { Request, RequestHandler, Response } from 'express';
import type { SessionPolicy } from '../../config/AppConfig.js';
import type { Clock } from '../../domain/Clock.js';
import type { User } from '../../domain/user/User.js';
import type { UserRepository } from '../../domain/user/UserRepository.js';
import {
  ForbiddenError,
  PasswordChangeRequiredError,
  UnauthenticatedError,
} from '../errors/AppError.js';

interface AuthOptions {
  /** Allow users who still have to change their initial password (e.g. the change-password endpoint). */
  allowPendingPasswordChange?: boolean;
}

/**
 * Resolves the signed-in user for each request. The user is re-loaded every time so
 * deactivation and role changes take effect immediately.
 */
export class Authenticator {
  constructor(
    private readonly users: UserRepository,
    private readonly clock: Clock,
    private readonly policy: SessionPolicy,
  ) {}

  requireAuth(options: AuthOptions = {}): RequestHandler {
    return async (req, res, next) => {
      const user = await this.resolveUser(req);
      if (!user) {
        throw new UnauthenticatedError();
      }
      this.sendExpiry(req, res);
      if (user.mustChangePassword && !options.allowPendingPasswordChange) {
        throw new PasswordChangeRequiredError();
      }
      req.currentUser = user;
      next();
    };
  }

  /**
   * Requires at least one of the given permissions. Roles are never checked directly:
   * permissions come from the shared role table plus individual grants.
   */
  requireAnyPermission(...permissions: Permission[]): RequestHandler {
    return (req, _res, next) => {
      const user = req.currentUser;
      if (!user) {
        throw new UnauthenticatedError();
      }
      if (!permissions.some((permission) => user.can(permission))) {
        throw new ForbiddenError();
      }
      next();
    };
  }

  /**
   * 「ログインを続ける」 on the warning (request 11/2): the session starts its week again, so a
   * person in the middle of a task is not signed out.
   */
  extend(req: Request, res: Response): string {
    req.session.authenticatedAt = this.clock.now().getTime();
    return this.sendExpiry(req, res);
  }

  /** The earlier of the idle limit (renewed by this request) and the absolute limit. */
  private sendExpiry(req: Request, res: Response): string {
    const now = this.clock.now().getTime();
    const absolute = (req.session.authenticatedAt ?? now) + this.policy.absoluteTimeoutMs;
    const expiresAt = new Date(Math.min(now + this.policy.idleTimeoutMs, absolute)).toISOString();
    res.setHeader(SESSION_EXPIRES_HEADER, expiresAt);
    return expiresAt;
  }

  private async resolveUser(req: Request): Promise<User | null> {
    const { userId, authenticatedAt } = req.session;
    if (!userId || !authenticatedAt) {
      return null;
    }
    if (this.clock.now().getTime() - authenticatedAt > this.policy.absoluteTimeoutMs) {
      await destroySession(req);
      return null;
    }
    const user = await this.users.findById(userId);
    if (!user?.isActive) {
      await destroySession(req);
      return null;
    }
    return user;
  }
}

export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((error: unknown) => (error ? reject(error) : resolve()));
  });
}

export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error: unknown) => (error ? reject(error) : resolve()));
  });
}
