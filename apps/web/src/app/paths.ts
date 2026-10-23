export const paths = {
  root: '/',
  login: '/login',
  changePassword: '/password',
  home: '/home',
  notifications: '/notifications',
  calls: '/calls',
  callsImport: '/calls/import',
  callsImports: '/calls/imports',
  callsDuplicates: '/calls/duplicates',
  company: (id: string) => `/calls/companies/${id}`,
  schedule: '/schedule',
  book: '/schedule/book',
  appointments: '/appointments',
  appointment: (id: string) => `/appointments/${id}`,
  appointmentMail: (id: string, kind: 'booking' | 'cancellation' | 'dayBefore') =>
    `/appointments/${id}/mail/${kind}`,
  dayBefore: '/appointments/day-before',
  changeRequests: '/appointments/change-requests',
  nextActions: '/appointments/next-actions',
  telema: '/telema',
  telemaShifts: '/telema/shifts',
  telemaAllocation: '/telema/allocation',
  telemaPeople: '/telema/people',
  dashboard: '/dashboard',
  admin: {
    root: '/admin',
    users: '/admin/users',
    calendar: '/admin/calendar',
    areaTable: '/admin/area-table',
    options: '/admin/options',
    notices: '/admin/notices',
    locks: '/admin/locks',
    settings: '/admin/settings',
    apps: '/admin/apps',
    audit: '/admin/audit',
  },
} as const;

/** Only allow same-app relative paths as post-login redirect targets (no open redirect). */
export function safeRedirectTarget(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith(paths.login)) {
    return null;
  }
  return value;
}
