import { randomUUID } from 'node:crypto';
import type { AuditEntry, AuditLogger } from '../../src/domain/audit/AuditLogger.js';
import type { Clock } from '../../src/domain/Clock.js';
import type { PasswordHasher } from '../../src/domain/security/PasswordHasher.js';
import { User } from '../../src/domain/user/User.js';
import type { NewUserData, UserRepository } from '../../src/domain/user/UserRepository.js';

export class FixedClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return new Date(this.current);
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

/** Deterministic, fast stand-in for argon2. */
export class PlainPasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }
  async verify(hash: string, plain: string): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}

export class InMemoryAuditLogger implements AuditLogger {
  readonly entries: AuditEntry[] = [];
  async record(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
  actions(): string[] {
    return this.entries.map((entry) => entry.action);
  }
}

export class InMemoryUserRepository implements UserRepository {
  private readonly rows = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.rows.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return [...this.rows.values()].find((user) => user.email === email.toLowerCase()) ?? null;
  }

  async create(data: NewUserData): Promise<User> {
    const now = new Date();
    const user = User.restore({
      id: randomUUID(),
      ...data,
      email: data.email.toLowerCase(),
      isActive: true,
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      passwordChangedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    this.rows.set(user.id, user);
    return user;
  }

  async saveSecurityState(user: User): Promise<void> {
    this.rows.set(user.id, User.restore(user.toProps()));
  }
}
