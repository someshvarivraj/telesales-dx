import {
  AppointmentStatus,
  ChangeRequestStatus,
  DayBeforeResult,
  MeetingFormat,
} from '@telesales/shared';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { ja } from '@/i18n/ja';

const STATUS_TONE: Record<AppointmentStatus, BadgeTone> = {
  [AppointmentStatus.Scheduled]: 'info',
  [AppointmentStatus.Completed]: 'success',
  [AppointmentStatus.Cancelled]: 'neutral',
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{ja.appointmentStatus[status]}</Badge>;
}

export function FormatBadge({ format }: { format: MeetingFormat }) {
  return (
    <Badge tone={format === MeetingFormat.Online ? 'info' : 'outline'}>{ja.format[format]}</Badge>
  );
}

const DAY_BEFORE_TONE: Record<DayBeforeResult, BadgeTone> = {
  [DayBeforeResult.Confirmed]: 'success',
  [DayBeforeResult.NotReached]: 'warning',
  [DayBeforeResult.Changed]: 'calls',
};

export function DayBeforeBadge({ result }: { result: DayBeforeResult | null }) {
  if (!result) return <Badge tone="outline">前日確認 未入力</Badge>;
  return <Badge tone={DAY_BEFORE_TONE[result]}>前日確認：{ja.dayBefore[result]}</Badge>;
}

const REQUEST_TONE: Record<ChangeRequestStatus, BadgeTone> = {
  [ChangeRequestStatus.Requested]: 'danger',
  [ChangeRequestStatus.InProgress]: 'warning',
  [ChangeRequestStatus.Done]: 'success',
  [ChangeRequestStatus.Withdrawn]: 'neutral',
};

export function ChangeRequestBadge({ status }: { status: ChangeRequestStatus }) {
  return <Badge tone={REQUEST_TONE[status]}>変更依頼：{ja.changeRequestStatus[status]}</Badge>;
}

export function ConfirmedBadge({ confirmedAt }: { confirmedAt: string | null }) {
  return confirmedAt ? (
    <Badge tone="success">営業確認済み</Badge>
  ) : (
    <Badge tone="warning">営業 未確認</Badge>
  );
}
