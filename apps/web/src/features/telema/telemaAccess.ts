import { Permission } from '@telesales/shared';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { todayJst } from '@/lib/format';

/** Mirrors the server rules (AccessPolicy) so the screens only offer what will be allowed. */
export function useTelemaAccess() {
  const { id, permissions } = useCurrentUser();
  const manages =
    permissions.includes(Permission.ConfirmAllocation) ||
    permissions.includes(Permission.Administer);
  const writesShifts = manages || permissions.includes(Permission.WriteShifts);
  return {
    userId: id,
    /** Leads and admins: everyone's shifts, allocation and telemarketer info. */
    manages,
    writesShifts,
    /** Own shift any day; someone else's from today on (they called in). */
    canEditShift: (ownerId: string, date: string) =>
      manages || (writesShifts && (ownerId === id || date >= todayJst())),
  };
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function weekdaysLabel(days: readonly number[]): string {
  return days.length === 0
    ? '―'
    : [...days]
        .sort()
        .map((day) => WEEKDAYS[day])
        .join('');
}

export const WEEKDAY_OPTIONS = WEEKDAYS.map((label, value) => ({ value, label }));

/** 450 → 7時間30分 */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}
