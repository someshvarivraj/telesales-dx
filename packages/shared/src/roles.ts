/** The application key. Login and users are company-wide; roles are granted per app. */
export const APP_KEY = 'telesales';

/** Spec v1 §4. One user can hold several roles. */
export const Role = {
  Telema: 'TELEMA',
  TelemaLead: 'TELEMA_LEAD',
  Sales: 'SALES',
  Viewer: 'VIEWER',
  Admin: 'ADMIN',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ALL_ROLES: readonly Role[] = Object.values(Role);

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ALL_ROLES as readonly string[]).includes(value);
}

/** Display order: the most specific role first. */
export function sortRoles(roles: readonly Role[]): Role[] {
  return ALL_ROLES.filter((role) => roles.includes(role));
}
