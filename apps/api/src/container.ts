import { APP_KEY } from '@telesales/shared';
import type { Logger } from 'pino';
import type { AppConfig } from './config/AppConfig.js';
import type { AuditLogger } from './domain/audit/AuditLogger.js';
import { type Clock, SystemClock } from './domain/Clock.js';
import type { PasswordHasher } from './domain/security/PasswordHasher.js';
import type { UserRepository } from './domain/user/UserRepository.js';
import { Authenticator } from './http/middleware/Authenticator.js';
import { PrismaService } from './infrastructure/database/PrismaService.js';
import { createLogger } from './infrastructure/logging/createLogger.js';
import { Argon2PasswordHasher } from './infrastructure/security/Argon2PasswordHasher.js';
import { TemporaryPasswordGenerator } from './infrastructure/security/TemporaryPasswordGenerator.js';
import {
  createSessionMiddleware,
  type SessionInfrastructure,
} from './infrastructure/session/createSessionMiddleware.js';
import { PrismaAuditLogger } from './modules/audit/PrismaAuditLogger.js';
import { AuthController } from './modules/auth/AuthController.js';
import { AuthService } from './modules/auth/AuthService.js';
import { PrismaUserRepository } from './modules/users/PrismaUserRepository.js';
import { UserService } from './modules/users/UserService.js';

/**
 * Composition root. The only place that knows concrete implementations;
 * everything else depends on interfaces passed through constructors.
 */
export class Container {
  readonly logger: Logger;
  readonly clock: Clock;
  readonly database: PrismaService;
  readonly users: UserRepository;
  readonly hasher: PasswordHasher;
  readonly audit: AuditLogger;
  readonly authService: AuthService;
  readonly userService: UserService;
  readonly authenticator: Authenticator;
  readonly authController: AuthController;

  private sessionInfra: SessionInfrastructure | undefined;

  constructor(readonly config: AppConfig) {
    this.logger = createLogger(config);
    this.clock = new SystemClock();
    this.database = new PrismaService(config.databaseUrl);
    this.users = new PrismaUserRepository(this.database.client, APP_KEY);
    this.hasher = new Argon2PasswordHasher();
    this.audit = new PrismaAuditLogger(this.database.client, this.logger);
    this.authService = new AuthService(
      this.users,
      this.hasher,
      this.audit,
      this.clock,
      config.login,
    );
    this.userService = new UserService(
      this.users,
      this.hasher,
      new TemporaryPasswordGenerator(),
      this.audit,
    );
    this.authenticator = new Authenticator(this.users, this.clock, config.session);
    this.authController = new AuthController(this.authService, this.clock);
  }

  get session(): SessionInfrastructure {
    this.sessionInfra ??= createSessionMiddleware(this.config);
    return this.sessionInfra;
  }

  async dispose(): Promise<void> {
    await this.sessionInfra?.close();
    await this.database.disconnect();
  }
}
