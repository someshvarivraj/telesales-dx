import { z } from 'zod';
import type { Role } from './roles.js';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().min(1).max(254).pipe(z.email()),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const newPasswordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newPassword: newPasswordSchema,
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

/** The signed-in user as exposed to the web app. Never contains secrets. */
export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  isTeamLead: boolean;
  mustChangePassword: boolean;
}

export interface SessionResponse {
  user: SessionUser;
}
