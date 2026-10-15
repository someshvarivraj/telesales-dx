import {
  AppointmentStatus,
  ChangeRequestStatus,
  DayBeforeResult,
  MeetingFormat,
} from '@telesales/shared';
import { Building2, Video } from 'lucide-react';
import { MetaLabel, StatusLabel, type StatusTone } from '@/components/ui/StatusLabel';
import { ja } from '@/i18n/ja';

/*
 * Appointment states. The main state is a dot and dark text; follow-up states
 * (sales check, day-before check, change request) are smaller and grey, so only the
 * dots carry colour and a row never turns into a strip of coloured boxes.
 */

const STATUS_TONE: Record<AppointmentStatus, StatusTone> = {
  [AppointmentStatus.Scheduled]: 'info',
  [AppointmentStatus.Completed]: 'success',
  [AppointmentStatus.Cancelled]: 'neutral',
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <StatusLabel tone={STATUS_TONE[status]}>{ja.appointmentStatus[status]}</StatusLabel>;
}

export function FormatBadge({ format }: { format: MeetingFormat }) {
  return (
    <MetaLabel icon={format === MeetingFormat.Online ? Video : Building2}>
      {ja.format[format]}
    </MetaLabel>
  );
}

const DAY_BEFORE_TONE: Record<DayBeforeResult, StatusTone> = {
  [DayBeforeResult.Confirmed]: 'success',
  [DayBeforeResult.NotReached]: 'warning',
  [DayBeforeResult.Changed]: 'info',
};

export function DayBeforeBadge({ result }: { result: DayBeforeResult | null }) {
  if (!result) {
    return (
      <StatusLabel tone="warning" secondary>
        前日確認 未入力
      </StatusLabel>
    );
  }
  return (
    <StatusLabel tone={DAY_BEFORE_TONE[result]} secondary>
      前日確認：{ja.dayBefore[result]}
    </StatusLabel>
  );
}

const REQUEST_TONE: Record<ChangeRequestStatus, StatusTone> = {
  [ChangeRequestStatus.Requested]: 'danger',
  [ChangeRequestStatus.InProgress]: 'warning',
  [ChangeRequestStatus.Done]: 'success',
  [ChangeRequestStatus.Withdrawn]: 'neutral',
};

export function ChangeRequestBadge({ status }: { status: ChangeRequestStatus }) {
  return (
    <StatusLabel tone={REQUEST_TONE[status]} secondary>
      変更依頼：{ja.changeRequestStatus[status]}
    </StatusLabel>
  );
}

export function ConfirmedBadge({ confirmedAt }: { confirmedAt: string | null }) {
  return confirmedAt ? (
    <StatusLabel tone="success" secondary>
      営業確認済み
    </StatusLabel>
  ) : (
    <StatusLabel tone="warning" secondary>
      営業 未確認
    </StatusLabel>
  );
}
