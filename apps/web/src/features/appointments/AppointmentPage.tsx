import { DayBeforeResult, jstDate, OptionCategory } from '@telesales/shared';
import {
  CalendarClock,
  Check,
  FileText,
  Mail,
  MessageSquareWarning,
  Pencil,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryState } from '@/components/ui/QueryState';
import { CommentThread } from '@/features/comments/CommentThread';
import { useOptionList } from '@/features/reference/useReference';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDate, formatDateTime, formatRange } from '@/lib/format';
import { ja } from '@/i18n/ja';
import {
  downloadAppointmentFile,
  useAppointment,
  useConfirmAppointment,
  useDayBeforeCheck,
} from './api';
import {
  AppointmentStatusBadge,
  ChangeRequestBadge,
  ConfirmedBadge,
  DayBeforeBadge,
  FormatBadge,
} from './AppointmentBadges';
import {
  CancelDialog,
  ChangeRequestDialog,
  EditDetailsDialog,
  MeetingUrlForm,
  RescheduleDialog,
} from './AppointmentDialogs';
import { PreparationSection } from './PreparationSection';
import { ResultSection } from './ResultSection';
import { TimelineSection } from './TimelineSection';
import { BackBar, BackLink } from '@/components/ui/BackLink';

type OpenDialog = 'reschedule' | 'cancel' | 'request' | 'edit' | null;

/**
 * The appointment page (spec §1, §2-2): details, handover notes, preparation, meeting
 * result and comments on one record that everyone involved can see.
 */
export function AppointmentPage() {
  const { id = '' } = useParams();
  const query = useAppointment(id);
  const confirm = useConfirmAppointment(id);
  const dayBefore = useDayBeforeCheck();
  const customerTypes = useOptionList(OptionCategory.CustomerType);
  const [dialog, setDialog] = useState<OpenDialog>(null);

  return (
    <QueryState query={query}>
      {(appointment) => {
        const { abilities } = appointment;
        const bookingMail = appointment.emails.filter((email) => email.noticeCode === 'N1');
        const sent = bookingMail.some((email) => email.status === 'SENT');
        const openRequest = appointment.changeRequests.find(
          (request) => request.status === 'REQUESTED' || request.status === 'IN_PROGRESS',
        );
        return (
          <>
            <PageHeader
              eyebrow={<BackLink to={paths.appointments}>{ja.module.appointments}へ戻る</BackLink>}
              title={appointment.company.name}
              actions={
                <>
                  {abilities.confirm && !appointment.salesConfirmedAt && (
                    <Button
                      icon={<Check className="size-4" aria-hidden="true" />}
                      loading={confirm.isPending}
                      onClick={() => confirm.mutate(undefined)}
                    >
                      確認しました
                    </Button>
                  )}
                  {abilities.requestChange && (
                    <Button
                      variant="secondary"
                      icon={<MessageSquareWarning className="size-4" aria-hidden="true" />}
                      onClick={() => setDialog('request')}
                    >
                      変更依頼を出す
                    </Button>
                  )}
                  {abilities.reschedule && (
                    <Button
                      variant="secondary"
                      icon={<CalendarClock className="size-4" aria-hidden="true" />}
                      onClick={() => setDialog('reschedule')}
                    >
                      日時・担当を変更
                    </Button>
                  )}
                  {abilities.editDetails && (
                    <Button
                      variant="secondary"
                      icon={<Pencil className="size-4" aria-hidden="true" />}
                      onClick={() => setDialog('edit')}
                    >
                      内容を編集
                    </Button>
                  )}
                  {abilities.cancel && (
                    <Button
                      variant="text"
                      icon={<XCircle className="size-4" aria-hidden="true" />}
                      onClick={() => setDialog('cancel')}
                    >
                      取り消し
                    </Button>
                  )}
                  {abilities.rebook && (
                    <Link
                      to={`${paths.book}?rebookOf=${appointment.id}`}
                      className="inline-flex h-10 items-center gap-2 rounded-(--radius-control) bg-main px-4 text-sm font-bold text-white hover:bg-main-hover"
                    >
                      <RotateCcw className="size-4" aria-hidden="true" />
                      再アポを登録
                    </Link>
                  )}
                </>
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold">
                  {formatRange(appointment.startsAt, appointment.endsAt)}
                </span>
                <FormatBadge format={appointment.format} />
                <AppointmentStatusBadge status={appointment.status} />
                {appointment.status === 'SCHEDULED' && (
                  <ConfirmedBadge confirmedAt={appointment.salesConfirmedAt} />
                )}
                {appointment.source !== 'SALES_BOOKED' && appointment.status === 'SCHEDULED' && (
                  <DayBeforeBadge result={appointment.dayBeforeResult} />
                )}
                {openRequest && <ChangeRequestBadge status={openRequest.status} />}
              </div>
            </PageHeader>

            <div className="mb-5 flex flex-col gap-2">
              {(confirm.isError || dayBefore.isError) && (
                <Alert tone="error">{errorMessageOf(confirm.error ?? dayBefore.error)}</Alert>
              )}
              {abilities.sendBookingMail && !sent && appointment.status !== 'CANCELLED' && (
                <Alert tone="warning">
                  営業さんへのメール（N1）はまだ送っていません。
                  <Link
                    to={paths.appointmentMail(appointment.id, 'booking')}
                    className="ml-2 font-bold text-link hover:underline"
                  >
                    確認して送る
                  </Link>
                </Alert>
              )}
              {appointment.status === 'CANCELLED' && (
                <Alert tone="info">
                  {appointment.cancelledAt &&
                    `${formatDateTime(appointment.cancelledAt)}に${appointment.cancelledBy?.name ?? ''}さんが取り消しました。`}
                  {abilities.rebook && (
                    <Link
                      to={paths.appointmentMail(appointment.id, 'cancellation')}
                      className="ml-2 font-bold text-link hover:underline"
                    >
                      取り消しのお知らせ（N8）を確認して送る
                    </Link>
                  )}
                </Alert>
              )}
              {appointment.originalAppointmentId && (
                <Alert tone="info">
                  取り消したアポの再アポです。
                  <Link
                    to={paths.appointment(appointment.originalAppointmentId)}
                    className="ml-2 font-bold text-link hover:underline"
                  >
                    元のアポ
                  </Link>
                </Alert>
              )}
              {appointment.rebookingIds.map((rebookingId) => (
                <Alert key={rebookingId} tone="info">
                  このアポの再アポがあります。
                  <Link
                    to={paths.appointment(rebookingId)}
                    className="ml-2 font-bold text-link hover:underline"
                  >
                    再アポを開く
                  </Link>
                </Alert>
              ))}
              {abilities.dayBeforeCheck && (
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">前日確認：</span>
                    {Object.values(DayBeforeResult).map((result) => (
                      <Button
                        key={result}
                        variant={appointment.dayBeforeResult === result ? 'primary' : 'secondary'}
                        loading={
                          dayBefore.isPending && dayBefore.variables.request.result === result
                        }
                        onClick={() =>
                          dayBefore.mutate({ id: appointment.id, request: { result } })
                        }
                      >
                        {ja.dayBefore[result]}
                      </Button>
                    ))}
                    {appointment.dayBeforeResult && (
                      <Link
                        to={paths.appointmentMail(appointment.id, 'dayBefore')}
                        className="ml-auto text-sm font-bold text-link hover:underline"
                      >
                        確認結果を営業へ送る（N14）
                      </Link>
                    )}
                  </div>
                </Card>
              )}
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <div className="flex flex-col gap-5 lg:col-span-2">
                <Card title="アポの詳細">
                  <DescriptionList
                    items={[
                      { label: '担当営業', value: appointment.salesRep.name },
                      {
                        label: '同席者',
                        value: appointment.attendees.map((a) => a.name).join('、'),
                      },
                      {
                        label: '先方担当者',
                        value: [appointment.contactDepartment, appointment.contactName]
                          .filter(Boolean)
                          .join(' '),
                      },
                      {
                        label: '先方TEL',
                        value: appointment.contactPhone ? (
                          <a className="text-link" href={`tel:${appointment.contactPhone}`}>
                            {appointment.contactPhone}
                          </a>
                        ) : null,
                      },
                      { label: '先方Mail', value: appointment.contactEmail },
                      {
                        label: '訪問先',
                        value:
                          appointment.format === 'VISIT'
                            ? (appointment.visitAddress ?? appointment.company.address)
                            : 'オンライン',
                      },
                      {
                        label: '伝達事項（取れたときの状況）',
                        value: appointment.handoverNotes,
                        wide: true,
                      },
                      { label: '取引区分', value: customerTypes.labelOf(appointment.customerType) },
                      { label: 'テレマリスト名', value: appointment.listName },
                      {
                        label: 'アポ取得',
                        value: `${formatDate(jstDate(new Date(appointment.bookedAt)))}・${appointment.bookedBy.name}`,
                      },
                      { label: '登録元', value: ja.source[appointment.source] },
                    ]}
                  />
                </Card>
                <PreparationSection appointment={appointment} />
                <ResultSection appointment={appointment} />
                <Card title="質問・コメント">
                  <CommentThread appointmentId={appointment.id} />
                </Card>
              </div>
              <div className="flex flex-col gap-5">
                <Card title="会議URL">
                  <MeetingUrlForm appointment={appointment} />
                </Card>
                <Card title="企業">
                  <DescriptionList
                    items={[
                      {
                        label: '会社名',
                        value: (
                          <Link
                            to={paths.company(appointment.company.id)}
                            className="text-link hover:underline"
                          >
                            {appointment.company.clientNo
                              ? `[${appointment.company.clientNo}] `
                              : ''}
                            {appointment.company.name}
                          </Link>
                        ),
                        wide: true,
                      },
                      { label: '代表TEL', value: appointment.company.phone },
                      { label: '最寄駅', value: appointment.company.nearestStation },
                      { label: '住所', value: appointment.company.address, wide: true },
                      {
                        label: 'URL',
                        value: appointment.company.url ? (
                          <a
                            href={appointment.company.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="break-all text-link"
                          >
                            {appointment.company.url}
                          </a>
                        ) : null,
                        wide: true,
                      },
                    ]}
                  />
                </Card>
                <Card title="メール">
                  <ul className="flex flex-col gap-2 text-sm">
                    {appointment.emails.length === 0 && (
                      <li className="text-ink-sub">まだメールはありません。</li>
                    )}
                    {appointment.emails.map((email) => (
                      <li key={email.id} className="flex items-start gap-2">
                        <Mail className="mt-0.5 size-4 shrink-0 text-ink-sub" aria-hidden="true" />
                        <span>
                          {email.subject}
                          <span className="block text-xs text-ink-sub">
                            {email.status === 'SENT' && email.sentAt
                              ? `送信済み ${formatDateTime(email.sentAt)}`
                              : email.status === 'FAILED'
                                ? '送信できませんでした'
                                : '下書き'}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {abilities.sendBookingMail && (
                    <Link
                      to={paths.appointmentMail(appointment.id, 'booking')}
                      className="mt-3 inline-block text-sm font-bold text-link hover:underline"
                    >
                      営業さんへのメール（N1）を開く
                    </Link>
                  )}
                </Card>
                {appointment.sourceFiles.length > 0 && (
                  <Card title="元のファイル">
                    <ul className="flex flex-col gap-2">
                      {appointment.sourceFiles.map((source) => (
                        <li key={source.file.id} className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void downloadAppointmentFile(
                                appointment.id,
                                source.file.id,
                                source.file.originalName,
                              )
                            }
                            className="flex cursor-pointer items-center gap-1.5 text-sm text-link hover:underline"
                          >
                            <FileText className="size-4" aria-hidden="true" />
                            {source.file.originalName}
                          </button>
                          <span className="text-xs text-ink-sub">
                            {ja.sourceFileType[source.sourceType]}
                            {source.rowNumber !== null && `・${source.rowNumber}行目`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
                <TimelineSection appointment={appointment} />
              </div>
            </div>

            {dialog === 'reschedule' && (
              <RescheduleDialog
                appointment={appointment}
                changeRequestId={openRequest?.id}
                onClose={() => setDialog(null)}
              />
            )}
            {dialog === 'cancel' && (
              <CancelDialog appointment={appointment} onClose={() => setDialog(null)} />
            )}
            {dialog === 'request' && (
              <ChangeRequestDialog appointment={appointment} onClose={() => setDialog(null)} />
            )}
            {dialog === 'edit' && (
              <EditDetailsDialog appointment={appointment} onClose={() => setDialog(null)} />
            )}
            <BackBar to={paths.appointments}>{ja.module.appointments}へ戻る</BackBar>
          </>
        );
      }}
    </QueryState>
  );
}
