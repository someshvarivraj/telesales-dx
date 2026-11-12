import { CSRF_HEADER, CSRF_HEADER_VALUE, Role, SESSION_EXPIRES_HEADER } from '@telesales/shared';
import express from 'express';
import session from 'express-session';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AppConfig } from '../src/config/AppConfig.js';
import { Authenticator } from '../src/http/middleware/Authenticator.js';
import { createErrorHandler } from '../src/http/middleware/errorHandler.js';
import { FixedClock, InMemoryUserRepository, PlainPasswordHasher } from './support/fakes.js';

/** A month (request 11/12; was a week). */
const MONTH = 30 * 24 * 60 * 60_000;
const config = AppConfig.fromEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://unused:unused@localhost:5432/unused',
  SESSION_SECRET: 'test-secret-that-is-long-enough-for-validation',
});

async function signedIn() {
  const users = new InMemoryUserRepository();
  const user = await users.create({
    employeeNo: null,
    name: 'テスト',
    email: 'test@example.co.jp',
    passwordHash: await new PlainPasswordHasher().hash('x'),
    roles: [Role.Telema],
    mustChangePassword: false,
  });
  const clock = new FixedClock(new Date('2026-11-02T00:00:00Z'));
  const authenticator = new Authenticator(users, clock, config.session);
  const app = express();
  app.use(session({ secret: config.session.secret, resave: false, saveUninitialized: false }));
  app.post('/sign-in', (req, res) => {
    req.session.userId = user.id;
    req.session.authenticatedAt = clock.now().getTime();
    res.end();
  });
  app.get('/me', authenticator.requireAuth(), (_req, res) => res.end());
  app.post('/extend', authenticator.requireAuth(), (req, res) => {
    res.json({ expiresAt: authenticator.extend(req, res) });
  });
  app.use(createErrorHandler(pino({ level: 'silent' })));
  const agent = request.agent(app);
  await agent.post('/sign-in').set(CSRF_HEADER, CSRF_HEADER_VALUE);
  return { agent, clock };
}

describe('session length and warning (requests 11/2, 11/12)', () => {
  it('lasts a month by default', () => {
    expect(config.session.idleTimeoutMs).toBe(MONTH);
    expect(config.session.absoluteTimeoutMs).toBe(MONTH);
  });

  it('tells the screen when the session ends', async () => {
    const { agent } = await signedIn();
    const res = await agent.get('/me').expect(200);
    expect(res.headers[SESSION_EXPIRES_HEADER.toLowerCase()]).toBe('2026-12-02T00:00:00.000Z');
  });

  it('starts the month again when the person carries on', async () => {
    const { agent, clock } = await signedIn();
    clock.advance(MONTH - 5 * 60_000);
    const res = await agent.post('/extend').set(CSRF_HEADER, CSRF_HEADER_VALUE).expect(200);
    expect(res.body.expiresAt).toBe('2026-12-31T23:55:00.000Z');
    clock.advance(10 * 60_000);
    await agent.get('/me').expect(200);
  });

  it('signs out after the month without carrying on', async () => {
    const { agent, clock } = await signedIn();
    clock.advance(MONTH + 60_000);
    await agent.get('/me').expect(401);
  });
});
