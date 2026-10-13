import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(480),
  SESSION_ABSOLUTE_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(720),
  LOGIN_MAX_FAILED_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  TRUST_PROXY: booleanFromString,
  WEB_DIST_DIR: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export interface LoginPolicy {
  readonly maxFailedAttempts: number;
  readonly lockDurationMs: number;
}

export interface SessionPolicy {
  readonly secret: string;
  readonly idleTimeoutMs: number;
  readonly absoluteTimeoutMs: number;
}

/** Validated, typed application configuration. Fails fast on startup when env is invalid. */
export class AppConfig {
  readonly env: 'development' | 'test' | 'production';
  readonly port: number;
  readonly logLevel: string;
  readonly databaseUrl: string;
  readonly trustProxy: boolean;
  readonly webDistDir: string | undefined;
  readonly session: SessionPolicy;
  readonly login: LoginPolicy;

  private constructor(values: z.infer<typeof envSchema>) {
    this.env = values.NODE_ENV;
    this.port = values.API_PORT;
    this.logLevel = values.LOG_LEVEL;
    this.databaseUrl = values.DATABASE_URL;
    this.trustProxy = values.TRUST_PROXY;
    this.webDistDir = values.WEB_DIST_DIR;
    this.session = {
      secret: values.SESSION_SECRET,
      idleTimeoutMs: values.SESSION_IDLE_TIMEOUT_MINUTES * 60_000,
      absoluteTimeoutMs: values.SESSION_ABSOLUTE_TIMEOUT_MINUTES * 60_000,
    };
    this.login = {
      maxFailedAttempts: values.LOGIN_MAX_FAILED_ATTEMPTS,
      lockDurationMs: values.LOGIN_LOCK_MINUTES * 60_000,
    };
  }

  get isProduction(): boolean {
    return this.env === 'production';
  }

  static fromEnv(source: NodeJS.ProcessEnv = process.env): AppConfig {
    const parsed = envSchema.safeParse(source);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw new Error(`Invalid environment configuration: ${details}`);
    }
    return new AppConfig(parsed.data);
  }
}
