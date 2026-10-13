import type { Role } from '@telesales/shared';
import type { User } from './User.js';

export interface NewUserData {
  employeeNo: string | null;
  name: string;
  email: string;
  passwordHash: string;
  roles: Role[];
  mustChangePassword: boolean;
}

/** Persistence port for users. Roles and grants are always loaded for the current app. */
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByEmployeeNo(employeeNo: string): Promise<User | null>;
  create(data: NewUserData): Promise<User>;
  /** Persists login counters, lock state and password fields of an existing user. */
  saveSecurityState(user: User): Promise<void>;
}
