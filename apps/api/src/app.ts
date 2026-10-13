import path from 'node:path';
import express, { type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { AppConfig } from './config/AppConfig.js';
import type { Authenticator } from './http/middleware/Authenticator.js';
import { csrfGuard } from './http/middleware/csrfGuard.js';
import { createErrorHandler, notFoundHandler } from './http/middleware/errorHandler.js';
import type { AuthController } from './modules/auth/AuthController.js';
import { createAuthRouter } from './modules/auth/authRouter.js';
import { createHealthRouter, type HealthCheck } from './modules/health/healthRouter.js';

/** Everything the HTTP layer needs. Kept as an interface so tests can pass fakes. */
export interface AppDependencies {
  config: AppConfig;
  logger: Logger;
  database: HealthCheck;
  sessionMiddleware: RequestHandler;
  authenticator: Authenticator;
  authController: AuthController;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  if (deps.config.trustProxy) {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(
    pinoHttp({
      logger: deps.logger,
      autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
    }),
  );

  app.use('/health', createHealthRouter(deps.database));

  const api = express.Router();
  api.use(express.json({ limit: '100kb' }));
  api.use(deps.sessionMiddleware);
  api.use(csrfGuard);
  api.use('/auth', createAuthRouter(deps.authController, deps.authenticator));
  api.use(notFoundHandler);
  app.use('/api', api);

  if (deps.config.webDistDir) {
    serveWebApp(app, deps.config.webDistDir);
  }

  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger));
  return app;
}

/** Serves the built SPA and falls back to index.html for client-side routes. */
function serveWebApp(app: Express, distDir: string): void {
  const root = path.resolve(distDir);
  app.use(express.static(root, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/|health\/).*/, (_req, res) => {
    res.sendFile(path.join(root, 'index.html'));
  });
}
