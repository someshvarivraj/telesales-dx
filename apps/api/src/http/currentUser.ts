import type { Request } from 'express';
import type { User } from '../domain/user/User.js';
import { UnauthenticatedError } from './errors/AppError.js';

/** The signed-in user. Only valid behind `requireAuth`. */
export function currentUserOf(req: Request): User {
  const user = req.currentUser;
  if (!user) {
    throw new UnauthenticatedError();
  }
  return user;
}
