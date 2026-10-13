import type { User } from '../domain/user/User.js';

declare module 'express-session' {
  interface SessionData {
    userId: string;
    /** Epoch ms when the user signed in; used for the absolute session timeout. */
    authenticatedAt: number;
  }
}

declare global {
  namespace Express {
    interface Request {
      /** Set by the authentication middleware for signed-in requests. */
      currentUser?: User;
    }
  }
}

export {};
