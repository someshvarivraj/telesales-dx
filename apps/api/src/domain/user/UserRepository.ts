import type { Role } from '@telesales/shared';
import type { User } from './User.js';

export interface NewUserData {
  email: string;
  displayName: string;
  passwordHash: string;
  role: Role;
  isTeamLead: boolean;
  mustChangePassword: boolean;
}

/** Persistence port for users. Implementations live in the infrastructure/modules layer. */
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: NewUserData): Promise<User>;
  /** Persists login counters, lock state and password fields of an existing user. */
  saveSecurityState(user: User): Promise<void>;
}
