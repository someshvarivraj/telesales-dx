import { APP_KEY } from '@telesales/shared';
import { Router as createRouter, type Router } from 'express';
import type { Logger } from 'pino';
import type { AppConfig } from './config/AppConfig.js';
import { AccessPolicy } from './domain/access/AccessPolicy.js';
import type { AuditLogger } from './domain/audit/AuditLogger.js';
import type { CalendarRepository } from './domain/calendar/CalendarRepository.js';
import { type Clock, SystemClock } from './domain/Clock.js';
import type { PasswordHasher } from './domain/security/PasswordHasher.js';
import type { UserRepository } from './domain/user/UserRepository.js';
import { Authenticator } from './http/middleware/Authenticator.js';
import { PrismaService } from './infrastructure/database/PrismaService.js';
import { createLogger } from './infrastructure/logging/createLogger.js';
import { createMailer } from './infrastructure/mail/createMailer.js';
import { Argon2PasswordHasher } from './infrastructure/security/Argon2PasswordHasher.js';
import { TemporaryPasswordGenerator } from './infrastructure/security/TemporaryPasswordGenerator.js';
import {
  createSessionMiddleware,
  type SessionInfrastructure,
} from './infrastructure/session/createSessionMiddleware.js';
import { LocalFileStorage } from './infrastructure/storage/LocalFileStorage.js';
import { createAdminRouter } from './modules/admin/adminRouter.js';
import { AdminUserService } from './modules/admin/AdminUserService.js';
import { NoticeSettingsService } from './modules/admin/NoticeSettingsService.js';
import { AppointmentBookingService } from './modules/appointments/AppointmentBookingService.js';
import { AppointmentImportService } from './modules/appointments/AppointmentImportService.js';
import { AppointmentMailService } from './modules/appointments/AppointmentMailService.js';
import { AppointmentQueryService } from './modules/appointments/AppointmentQueryService.js';
import { AppointmentReportService } from './modules/appointments/AppointmentReportService.js';
import { createAppointmentsRouter } from './modules/appointments/appointmentsRouter.js';
import { AppointmentWorkService } from './modules/appointments/AppointmentWorkService.js';
import { NextActionService } from './modules/appointments/NextActionService.js';
import { AppService } from './modules/apps/AppService.js';
import { createSystemRouter } from './modules/apps/systemRouter.js';
import { AreaTableService } from './modules/area/AreaTableService.js';
import { createAssistantRouter } from './modules/assistant/assistantRouter.js';
import { AssistantActionRunner } from './modules/assistant/AssistantActionRunner.js';
import { AssistantActions } from './modules/assistant/AssistantActions.js';
import { AssistantConversations } from './modules/assistant/AssistantConversations.js';
import { AssistantService } from './modules/assistant/AssistantService.js';
import { AssistantTools } from './modules/assistant/AssistantTools.js';
import { AuditLogService } from './modules/audit/AuditLogService.js';
import { PrismaAuditLogger } from './modules/audit/PrismaAuditLogger.js';
import { AuthController } from './modules/auth/AuthController.js';
import { AuthService } from './modules/auth/AuthService.js';
import { CalendarService } from './modules/calendar/CalendarService.js';
import { PrismaCalendarRepository } from './modules/calendar/PrismaCalendarRepository.js';
import { CallRecordExportService } from './modules/callRecords/CallRecordExportService.js';
import { CallRecordService } from './modules/callRecords/CallRecordService.js';
import { CommentService } from './modules/comments/CommentService.js';
import { FeedbackService } from './modules/feedback/FeedbackService.js';
import { createFeedbackRouter } from './modules/feedback/feedbackRouter.js';
import { createCompaniesRouter } from './modules/companies/companiesRouter.js';
import { CompanyService } from './modules/companies/CompanyService.js';
import { ListImportService } from './modules/companies/ListImportService.js';
import { DashboardService } from './modules/dashboard/DashboardService.js';
import { FileService } from './modules/files/FileService.js';
import { ScheduledJobs } from './modules/jobs/ScheduledJobs.js';
import { EmailService } from './modules/notifications/EmailService.js';
import { NotificationService } from './modules/notifications/NotificationService.js';
import { createNotificationsRouter } from './modules/notifications/notificationsRouter.js';
import { RecipientResolver } from './modules/notifications/RecipientResolver.js';
import { OptionService } from './modules/options/OptionService.js';
import { createReferenceRouter } from './modules/reference/referenceRouter.js';
import { createScheduleRouter } from './modules/schedule/scheduleRouter.js';
import { ScheduleService } from './modules/schedule/ScheduleService.js';
import { SlotGuard } from './modules/schedule/SlotGuard.js';
import { SettingsService } from './modules/settings/SettingsService.js';
import { PrismaUserRepository } from './modules/users/PrismaUserRepository.js';
import { AllocationService } from './modules/telema/AllocationService.js';
import { TelemaService } from './modules/telema/TelemaService.js';
import { createTelemaRouter } from './modules/telema/telemaRouter.js';
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
  readonly jobs: ScheduledJobs;
  readonly apiRouters: Router[];

  private sessionInfra: SessionInfrastructure | undefined;

  constructor(readonly config: AppConfig) {
    this.logger = createLogger(config);
    this.clock = new SystemClock();
    this.database = new PrismaService(config.databaseUrl);
    const prisma = this.database.client;
    this.users = new PrismaUserRepository(prisma, APP_KEY);
    this.hasher = new Argon2PasswordHasher();
    this.audit = new PrismaAuditLogger(prisma, this.logger);
    const passwords = new TemporaryPasswordGenerator();
    this.authService = new AuthService(
      this.users,
      this.hasher,
      this.audit,
      this.clock,
      config.login,
    );
    this.userService = new UserService(this.users, this.hasher, passwords, this.audit);
    this.authenticator = new Authenticator(this.users, this.clock, config.session);
    this.authController = new AuthController(this.authService, this.clock);

    // Shared building blocks
    const policy = new AccessPolicy();
    const calendarRepository: CalendarRepository = new PrismaCalendarRepository(prisma);
    const files = new FileService(prisma, new LocalFileStorage(config.fileStorageDir));
    const mailer = createMailer(config.mail, config.fileStorageDir, this.logger);
    const emails = new EmailService(prisma, mailer, files, this.audit, this.logger);
    const recipients = new RecipientResolver(prisma);
    const notifications = new NotificationService(prisma, recipients, emails, this.logger);
    const options = new OptionService(prisma, this.audit);
    const settings = new SettingsService(prisma, this.audit);
    const calendar = new CalendarService(prisma, this.audit, async () => {
      const response = await fetch(config.holidayCsvUrl, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) {
        throw new Error(`Holiday CSV download failed: ${response.status}`);
      }
      return Buffer.from(await response.arrayBuffer());
    });
    const adminUsers = new AdminUserService(
      prisma,
      this.userService,
      this.hasher,
      passwords,
      this.audit,
      this.clock,
    );
    const area = new AreaTableService(prisma, this.audit, this.clock);
    const guard = new SlotGuard(
      prisma,
      calendarRepository,
      settings,
      this.clock,
      config.slotLockTtlMs,
    );

    // ① Calls
    const companies = new CompanyService(prisma, this.audit, this.clock);
    const listImports = new ListImportService(prisma, files, options, notifications, this.audit);
    const callRecords = new CallRecordService(prisma, policy, this.audit, this.clock);
    const callExports = new CallRecordExportService(prisma, options, this.clock);
    const comments = new CommentService(prisma, notifications);

    // ② Schedule and appointments
    const schedule = new ScheduleService(
      prisma,
      guard,
      policy,
      settings,
      notifications,
      this.audit,
    );
    const queries = new AppointmentQueryService(prisma, policy, calendarRepository, this.clock);
    const booking = new AppointmentBookingService(
      prisma,
      guard,
      policy,
      queries,
      notifications,
      this.audit,
    );
    const work = new AppointmentWorkService(
      prisma,
      policy,
      queries,
      files,
      notifications,
      this.audit,
      this.clock,
    );
    const mail = new AppointmentMailService(
      prisma,
      policy,
      queries,
      emails,
      recipients,
      notifications,
      options,
      this.clock,
    );
    const appointmentImports = new AppointmentImportService(prisma, files);
    const reports = new AppointmentReportService(prisma, options, this.clock);
    const nextActions = new NextActionService(prisma, policy, this.audit, this.clock);

    // ② Telemarketing (priority 2)
    const team = new TelemaService(
      prisma,
      policy,
      calendarRepository,
      notifications,
      this.audit,
      this.clock,
    );
    const allocations = new AllocationService(
      prisma,
      policy,
      team,
      calendarRepository,
      notifications,
      this.audit,
      this.clock,
    );
    const dashboard = new DashboardService(
      prisma,
      calendarRepository,
      allocations,
      nextActions,
      this.clock,
    );
    const apps = new AppService(prisma, this.audit, this.clock);

    this.jobs = new ScheduledJobs(
      prisma,
      calendarRepository,
      emails,
      recipients,
      notifications,
      reports,
      files,
      options,
      settings,
      allocations,
      this.clock,
      config.appBaseUrl,
      this.logger,
    );

    const authenticator = this.authenticator;
    const assistant = new AssistantService(
      config.assistant,
      new AssistantTools({
        prisma,
        clock: this.clock,
        dashboard,
        schedule,
        queries,
        actions: new AssistantActions({ prisma, clock: this.clock, guard, queries, area }),
      }),
      this.clock,
      this.logger,
    );
    this.apiRouters = [
      createSystemRouter(apps),
      createReferenceRouter({ authenticator, options, users: adminUsers, calendar, settings }),
      createCompaniesRouter({
        authenticator,
        companies,
        imports: listImports,
        callRecords,
        callExports,
        comments,
        area,
        files,
      }),
      createScheduleRouter({ authenticator, schedule, guard }),
      createAppointmentsRouter({
        authenticator,
        queries,
        booking,
        work,
        mail,
        imports: appointmentImports,
        reports,
        nextActions,
      }),
      createTelemaRouter({ authenticator, team, allocations }),
      createNotificationsRouter({ authenticator, notifications, dashboard }),
      createFeedbackRouter({
        authenticator,
        feedback: new FeedbackService(prisma, notifications, this.audit, config.appBaseUrl),
      }),
      createAssistantRouter({
        authenticator,
        assistant,
        conversations: new AssistantConversations(
          prisma,
          assistant,
          new AssistantActionRunner({ schedule, callRecords, work, booking }),
          this.clock,
        ),
        logger: this.logger,
      }),
    ];
    const adminRouter = createAdminRouter({
      authenticator,
      users: adminUsers,
      options,
      calendar,
      notices: new NoticeSettingsService(prisma, this.audit),
      area,
      guard,
      settings,
      apps,
      audit: this.audit,
      history: new AuditLogService(prisma, this.clock),
      jobs: this.jobs,
    });
    this.apiRouters.push(mountAt('/admin', adminRouter));
  }

  get session(): SessionInfrastructure {
    this.sessionInfra ??= createSessionMiddleware(this.config);
    return this.sessionInfra;
  }

  async dispose(): Promise<void> {
    this.jobs.stop();
    await this.sessionInfra?.close();
    await this.database.disconnect();
  }
}

function mountAt(prefix: string, router: Router): Router {
  return createRouter().use(prefix, router);
}
