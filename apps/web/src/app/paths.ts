export const paths = {
  root: '/',
  login: '/login',
  changePassword: '/password',
  home: '/home',
  calls: '/calls',
  schedule: '/schedule',
  appointments: '/appointments',
  admin: {
    root: '/admin',
    users: '/admin/users',
    calendar: '/admin/calendar',
    areaTable: '/admin/area-table',
    options: '/admin/options',
    notices: '/admin/notices',
    locks: '/admin/locks',
  },
} as const;

/** Only allow same-app relative paths as post-login redirect targets (no open redirect). */
export function safeRedirectTarget(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith(paths.login)) {
    return null;
  }
  return value;
}
