import { Role } from '@telesales/shared';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { WORK_END, WORK_START } from './calendar/layout';

/**
 * Telemarketing books within office hours, so their calendars show 9:00–18:00 only, taller
 * (request 11/27), not the 5:00–24:00 sales use. Someone who also sells keeps the full day.
 */
export function useTelemaHours(): boolean {
  const { roles } = useCurrentUser();
  const telema = roles.includes(Role.Telema) || roles.includes(Role.TelemaLead);
  return telema && !roles.includes(Role.Sales);
}

/** Props for a time grid in 9–18 mode. */
export const WORK_HOURS_GRID = { dayStart: WORK_START, dayEnd: WORK_END, fit: true } as const;
