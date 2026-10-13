import connectPgSimple from 'connect-pg-simple';
import type { RequestHandler } from 'express';
import session from 'express-session';
import pg from 'pg';
import type { AppConfig } from '../../config/AppConfig.js';

export const SESSION_COOKIE_NAME = 'tsdx.sid';

export interface SessionInfrastructure {
  middleware: RequestHandler;
  close(): Promise<void>;
}

/**
 * Server-side sessions stored in PostgreSQL. The cookie only holds a signed id;
 * idle timeout is enforced by `rolling` + maxAge, absolute timeout by the Authenticator.
 */
export function createSessionMiddleware(config: AppConfig): SessionInfrastructure {
  const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 5 });
  const PgStore = connectPgSimple(session);
  const store = new PgStore({
    pool,
    tableName: 'session',
    createTableIfMissing: false,
    pruneSessionInterval: 15 * 60,
  });

  const middleware = session({
    name: SESSION_COOKIE_NAME,
    secret: config.session.secret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: config.trustProxy,
    cookie: {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: config.session.idleTimeoutMs,
    },
  });

  return {
    middleware,
    close: async () => {
      store.close();
      await pool.end();
    },
  };
}
