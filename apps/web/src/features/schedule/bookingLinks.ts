import { AppointmentSource } from '@telesales/shared';
import { paths } from '@/app/paths';

/**
 * Existing-list booking (flow v4 §1): the rep comes from the sales area table before the call,
 * the slot is held during the call, and the CSV / handover PDF only fills in the details.
 * A rep chosen in 「表示する人」 is carried over; otherwise the page opens the rep finder.
 */
export function existingListBookingHref(date: string, repId?: string): string {
  const query = new URLSearchParams({ source: AppointmentSource.File, date });
  if (repId) query.set('repId', repId);
  return `${paths.book}?${query.toString()}`;
}
