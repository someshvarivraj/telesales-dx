import { createApp } from './app.js';
import { AppConfig } from './config/AppConfig.js';
import { Container } from './container.js';

async function main(): Promise<void> {
  const config = AppConfig.fromEnv();
  const container = new Container(config);
  const { logger } = container;

  const app = createApp({
    config,
    logger,
    database: container.database,
    sessionMiddleware: container.session.middleware,
    authenticator: container.authenticator,
    authController: container.authController,
    apiRouters: container.apiRouters,
    publicRouters: container.publicRouters,
  });

  if (config.jobsEnabled) {
    container.jobs.start();
  }

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.env }, 'API server started');
  });

  const shutdown = (signal: string, code = 0) => {
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      await container.dispose();
      process.exit(code);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Last-resort safety nets (11/18 audit). A promise nobody awaited is logged and the server
  // keeps serving; an exception nothing caught leaves the process in an unknown state, so it is
  // logged and the process exits for the container to restart it.
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'unhandled promise rejection');
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'uncaught exception, exiting');
    shutdown('uncaughtException', 1);
  });
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Failed to start: ${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exit(1);
});
