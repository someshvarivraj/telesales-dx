import { pino, type Logger } from 'pino';
import type { AppConfig } from '../../config/AppConfig.js';

/** Structured JSON logs in production; human-readable output in development. */
export function createLogger(config: AppConfig): Logger {
  return pino({
    level: config.logLevel,
    redact: {
      paths: ['req.headers.cookie', 'req.headers.authorization', '*.password', '*.passwordHash'],
      censor: '[REDACTED]',
    },
    ...(config.isProduction
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
          },
        }),
  });
}
