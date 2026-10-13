import { ROLE_HOME_PATH, Role } from '@telesales/shared';

export const paths = {
  root: '/',
  login: '/login',
  changePassword: '/password',
  telema: {
    home: ROLE_HOME_PATH[Role.Telema],
    calls: `${ROLE_HOME_PATH[Role.Telema]}/calls`,
    schedule: `${ROLE_HOME_PATH[Role.Telema]}/schedule`,
  },
  sales: {
    home: ROLE_HOME_PATH[Role.Sales],
    calls: `${ROLE_HOME_PATH[Role.Sales]}/calls`,
    schedule: `${ROLE_HOME_PATH[Role.Sales]}/schedule`,
  },
  admin: {
    home: ROLE_HOME_PATH[Role.Admin],
    users: `${ROLE_HOME_PATH[Role.Admin]}/users`,
    masters: `${ROLE_HOME_PATH[Role.Admin]}/masters`,
  },
} as const;

/** Only allow same-app relative paths as post-login redirect targets (no open redirect). */
export function safeRedirectTarget(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith(paths.login)) {
    return null;
  }
  return value;
}
