import { CSRF_HEADER, CSRF_HEADER_VALUE, ErrorCode, Permission, Role } from '@telesales/shared';
import express from 'express';
import session from 'express-session';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AppConfig } from '../src/config/AppConfig.js';
import { Authenticator } from '../src/http/middleware/Authenticator.js';
import { createErrorHandler } from '../src/http/middleware/errorHandler.js';
import { FixedClock, InMemoryUserRepository, PlainPasswordHasher } from './support/fakes.js';

const config = AppConfig.fromEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://unused:unused@localhost:5432/unused',
  SESSION_SECRET: 'test-secret-that-is-long-enough-for-validation',
});

/** A tiny app with one protected route, signing in through a test-only endpoint. */
async function appWithUser(roles: Role[]) {
  const users = new InMemoryUserRepository();
  const user = await users.create({
    employeeNo: null,
    name: 'テスト',
    email: 'test@example.co.jp',
    passwordHash: await new PlainPasswordHasher().hash('x'),
    roles,
    mustChangePassword: false,
  });
  const clock = new FixedClock(new Date());
  const authenticator = new Authenticator(users, clock, config.session);
  const app = express();
  app.use(session({ secret: config.session.secret, resave: false, saveUninitialized: false }));
  app.post('/sign-in', (req, res) => {
    req.session.userId = user.id;
    req.session.authenticatedAt = clock.now().getTime();
    res.end();
  });
  app.post(
    '/appointments',
    authenticator.requireAuth(),
    authenticator.requireAnyPermission(Permission.ManageTelemaAppointments),
    (_req, res) => res.status(201).end(),
  );
  app.use(createErrorHandler(pino({ level: 'silent' })));
  const agent = request.agent(app);
  await agent.post('/sign-in').set(CSRF_HEADER, CSRF_HEADER_VALUE);
  return agent;
}

describe('Authenticator.requireAnyPermission', () => {
  it('lets a telemarketer book', async () => {
    const agent = await appWithUser([Role.Telema]);
    await agent.post('/appointments').expect(201);
  });

  it('blocks a viewer', async () => {
    const agent = await appWithUser([Role.Viewer]);
    const res = await agent.post('/appointments');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ErrorCode.Forbidden);
  });

  it('allows a user whose second role grants the permission', async () => {
    const agent = await appWithUser([Role.Sales, Role.Telema]);
    await agent.post('/appointments').expect(201);
  });
});
