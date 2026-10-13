export const Role = {
  Telema: 'TELEMA',
  Sales: 'SALES',
  Admin: 'ADMIN',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ALL_ROLES: readonly Role[] = Object.values(Role);

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ALL_ROLES as readonly string[]).includes(value);
}

/** Base path of each role's area in the web app. Shared so redirects stay consistent. */
export const ROLE_HOME_PATH: Readonly<Record<Role, string>> = {
  [Role.Telema]: '/telema',
  [Role.Sales]: '/sales',
  [Role.Admin]: '/admin',
};
