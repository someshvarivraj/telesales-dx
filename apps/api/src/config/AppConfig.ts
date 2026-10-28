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
  /** Where uploaded files are kept (local disk; swap FileStorage for S3 in AWS). */
  FILE_STORAGE_DIR: z.string().default('./storage'),
  /** Public URL of the app, used for links in e-mails. */
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),
  MAIL_FROM: z.string().min(3).default('テレマ・営業DX <no-reply@example.co.jp>'),
  /** smtp(s)://user:pass@host:port — when empty, e-mails are written to the outbox folder instead. */
  SMTP_URL: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined)),
  /**
   * Comma-separated addresses or @domains that may receive real e-mail (e.g. on staging
   * during a test). Other recipients are left out and the mail is kept in the outbox.
   * Empty = no limit.
   */
  MAIL_ALLOWED_RECIPIENTS: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? '')
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  /**
   * MoraBot assistant: an OpenAI-compatible chat endpoint (Google Gemini:
   * https://generativelanguage.googleapis.com/v1beta/openai). Empty = assistant off.
   * Sends questions and looked-up data outside AWS: needs the company's approval.
   */
  AI_BASE_URL: z
    .string()
    .optional()
    .transform((value) => value || ''),
  AI_API_KEY: z
    .string()
    .optional()
    .transform((value) => value || ''),
  AI_MODEL: z.string().min(1).default('gemini-pro-latest'),
  /** Optional: low / medium / high, passed as reasoning_effort (faster, cheaper when low). */
  AI_REASONING_EFFORT: z.enum(['low', 'medium', 'high']).optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().min(5000).max(300000).default(60000),
  /** Run the scheduled jobs (N4, N19…) in this process. Enable on exactly one instance. */
  JOBS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  /** Edit lock is released this long after the last heartbeat (spec §7: about 1–2 minutes). */
  SLOT_LOCK_TTL_SECONDS: z.coerce.number().int().min(30).max(600).default(120),
  /** Cabinet Office public-holiday CSV (Shift_JIS). */
  HOLIDAY_CSV_URL: z
    .string()
    .url()
    .default('https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv'),
  WEB_DIST_DIR: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export interface LoginPolicy {
  readonly maxFailedAttempts: number;
  readonly lockDurationMs: number;
}

export interface AssistantConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly reasoningEffort: 'low' | 'medium' | 'high' | undefined;
  readonly timeoutMs: number;
}

export interface MailConfig {
  readonly from: string;
  readonly smtpUrl: string | undefined;
  /** Empty = anyone may receive mail. */
  readonly allowedRecipients: readonly string[];
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
  readonly fileStorageDir: string;
  readonly appBaseUrl: string;
  readonly mail: MailConfig;
  readonly assistant: AssistantConfig;
  readonly jobsEnabled: boolean;
  readonly slotLockTtlMs: number;
  readonly holidayCsvUrl: string;

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
    this.fileStorageDir = values.FILE_STORAGE_DIR;
    this.appBaseUrl = values.APP_BASE_URL.replace(/\/$/, '');
    this.mail = {
      from: values.MAIL_FROM,
      smtpUrl: values.SMTP_URL,
      allowedRecipients: values.MAIL_ALLOWED_RECIPIENTS,
    };
    this.assistant = {
      baseUrl: values.AI_BASE_URL,
      apiKey: values.AI_API_KEY,
      model: values.AI_MODEL,
      reasoningEffort: values.AI_REASONING_EFFORT,
      timeoutMs: values.AI_TIMEOUT_MS,
    };
    this.jobsEnabled = values.JOBS_ENABLED;
    this.slotLockTtlMs = values.SLOT_LOCK_TTL_SECONDS * 1000;
    this.holidayCsvUrl = values.HOLIDAY_CSV_URL;
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
