import { CSRF_HEADER, CSRF_HEADER_VALUE, ErrorCode, Permission, Role } from '@telesales/shared';
import session from 'express-session';
import { pino } from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { AppConfig } from '../src/config/AppConfig.js';
import { Authenticator } from '../src/http/middleware/Authenticator.js';
import { AuthController } from '../src/modules/auth/AuthController.js';
import { AuthService } from '../src/modules/auth/AuthService.js';
import {
  FixedClock,
  InMemoryAuditLogger,
  InMemoryUserRepository,
  PlainPasswordHasher,
} from './support/fakes.js';

const config = AppConfig.fromEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://unused:unused@localhost:5432/unused',
  SESSION_SECRET: 'test-secret-that-is-long-enough-for-validation',
});

async function buildApp() {
  const users = new InMemoryUserRepository();
  const hasher = new PlainPasswordHasher();
  const clock = new FixedClock(new Date());
  await users.create({
    email: 'sato@example.co.jp',
    employeeNo: '2001',
    name: '佐藤',
    passwordHash: await hasher.hash('initial-password-123'),
    roles: [Role.Sales, Role.Viewer],
    mustChangePassword: true,
  });
  const authService = new AuthService(
    users,
    hasher,
    new InMemoryAuditLogger(),
    clock,
    config.login,
  );
  return createApp({
    config,
    logger: pino({ level: 'silent' }),
    database: { isHealthy: async () => true },
    sessionMiddleware: session({
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
    }),
    authenticator: new Authenticator(users, clock, config.session),
    authController: new AuthController(authService, clock),
  });
}

describe('HTTP app', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
  });

  it('reports liveness', async () => {
    await request(app).get('/health/live').expect(200, { status: 'ok' });
  });

  it('rejects state-changing requests without the CSRF header', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ErrorCode.CsrfRejected);
  });

  it('returns field errors for an invalid login body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set(CSRF_HEADER, CSRF_HEADER_VALUE)
      .send({ email: 'not-an-email', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ErrorCode.ValidationFailed);
    expect(Object.keys(res.body.error.fields)).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
  });

  it('signs in, exposes the session user and requires a password change', async () => {
    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .set(CSRF_HEADER, CSRF_HEADER_VALUE)
      .send({ email: 'SATO@example.co.jp', password: 'initial-password-123' });
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({
      roles: [Role.Sales, Role.Viewer],
      mustChangePassword: true,
    });
    expect(login.body.user.permissions).toContain(Permission.SendChangeRequests);
    expect(login.body.user.permissions).not.toContain(Permission.ManageTelemaAppointments);
    expect(login.body.user.passwordHash).toBeUndefined();

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('sato@example.co.jp');
  });

  it('returns 401 for /me without a session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ErrorCode.Unauthenticated);
  });
});
