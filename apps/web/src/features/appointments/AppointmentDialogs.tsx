import {
  type AppointmentDetail,
  type ChangeReason,
  ChangeReason as Reason,
  jstDate,
  jstTime,
} from '@telesales/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { Textarea } from '@/components/ui/Textarea';
import { TextInput } from '@/components/ui/TextInput';
import { type Slot, SlotPicker } from '@/features/schedule/SlotPicker';
import { slotProblemText } from '@/features/schedule/slotProblems';
import { useSlotLock } from '@/features/schedule/useSlotLock';
import { ApiError } from '@/lib/api/ApiError';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatRange, toInstant } from '@/lib/format';
import { ja } from '@/i18n/ja';
import { AppointmentFields, type AppointmentValues } from './AppointmentFields';
import {
  useCancelAppointment,
  useMeetingUrl,
  useReschedule,
  useRequestChange,
  useUpdateAppointment,
} from './api';

interface DialogProps {
  appointment: AppointmentDetail;
  onClose: () => void;
}

function ErrorWithProblems({ error }: { error: unknown }) {
  return (
    <Alert tone="error">
      {errorMessageOf(error)}
      {ApiError.isApiError(error) && Array.isArray(error.details) && (
        <ul className="mt-1 list-inside list-disc">
          {error.details.map((problem, index) => (
            <li key={index}>{slotProblemText(problem)}</li>
          ))}
        </ul>
      )}
    </Alert>
  );
}

/** Moves the same appointment (time and/or rep) with the reason モ変 / 先変 (spec §7). */
export function RescheduleDialog({
  appointment,
  onClose,
  changeRequestId,
}: DialogProps & { changeRequestId?: string }) {
  const reschedule = useReschedule(appointment.id);
  const lock = useSlotLock();
  const start = new Date(appointment.startsAt);
  const end = new Date(appointment.endsAt);
  const [slot, setSlot] = useState<Slot>({
    repId: appointment.salesRep.id,
    date: jstDate(start),
    start: jstTime(start),
    end: jstTime(end),
  });
  const [reason, setReason] = useState<ChangeReason | ''>('');

  const close = () => {
    void lock.release();
    onClose();
  };
  const submit = () =>
    reschedule.mutate(
      {
        expectedVersion: appointment.version,
        salesRepId: slot.repId,
        startsAt: toInstant(slot.date, slot.start),
        endsAt: toInstant(slot.date, slot.end),
        reason: reason as ChangeReason,
        changeRequestId: changeRequestId ?? null,
      },
      {
        onSuccess: () => {
          lock.forget();
          onClose();
        },
      },
    );

  return (
    <Dialog
      open
      onClose={close}
      size="lg"
      title="日時・担当営業の変更"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            キャンセル
          </Button>
          <Button
            loading={reschedule.isPending}
            disabled={lock.state.status !== 'held' || !reason}
            onClick={submit}
          >
            変更する
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-sub">
          いま：{formatRange(appointment.startsAt, appointment.endsAt)}・{appointment.salesRep.name}
          。同じアポのまま日時を移します（新しいアポは作りません）。
        </p>
        {reschedule.isError && <ErrorWithProblems error={reschedule.error} />}
        <SlotPicker
          slot={slot}
          onChange={setSlot}
          lock={lock.state}
          appointmentId={appointment.id}
          onLock={() =>
            void lock.acquire(
              slot.repId,
              toInstant(slot.date, slot.start),
              toInstant(slot.date, slot.end),
            )
          }
          onUnlock={() => void lock.release()}
        />
        <fieldset>
          <legend className="mb-1 text-sm font-bold">理由</legend>
          <div className="flex gap-6">
            {[Reason.OurSide, Reason.CustomerSide].map((value) => (
              <Checkbox
                key={value}
                type="radio"
                name="reason"
                label={ja.changeReason[value]}
                checked={reason === value}
                onChange={() => setReason(value)}
              />
            ))}
          </div>
        </fieldset>
        <p className="text-xs text-ink-sub">
          変更すると、予定表・前日確認・担当営業へのお知らせ（N6）に反映されます。
        </p>
      </div>
    </Dialog>
  );
}

/** Manual, confirmed cancellation. The notice e-mail (N8) is checked and sent next. */
export function CancelDialog({ appointment, onClose }: DialogProps) {
  const cancel = useCancelAppointment(appointment.id);
  const navigate = useNavigate();
  const [note, setNote] = useState('');
  return (
    <Dialog
      open
      onClose={onClose}
      title="アポを取り消しますか？"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            やめる
          </Button>
          <Button
            variant="danger"
            loading={cancel.isPending}
            onClick={() =>
              cancel.mutate(
                { expectedVersion: appointment.version, note },
                {
                  onSuccess: () => navigate(paths.appointmentMail(appointment.id, 'cancellation')),
                },
              )
            }
          >
            取り消す
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {cancel.isError && <Alert tone="error">{errorMessageOf(cancel.error)}</Alert>}
        <p className="text-sm">
          {appointment.company.name}（{formatRange(appointment.startsAt, appointment.endsAt)}
          ）を取り消します。枠は空きに戻ります。
          このあと、取り消しのお知らせメール（N8）の確認画面を開きます。
        </p>
        <FormField label="理由・メモ">
          {(c) => (
            <Textarea {...c} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          )}
        </FormField>
      </div>
    </Dialog>
  );
}

/** Sales ask telemarketing to change the appointment (N7 to all telemarketers). */
export function ChangeRequestDialog({ appointment, onClose }: DialogProps) {
  const request = useRequestChange(appointment.id);
  const [message, setMessage] = useState('');
  return (
    <Dialog
      open
      onClose={onClose}
      title="変更依頼を出す"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            loading={request.isPending}
            disabled={!message.trim()}
            onClick={() => request.mutate(message.trim(), { onSuccess: onClose })}
          >
            依頼する
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {request.isError && <Alert tone="error">{errorMessageOf(request.error)}</Alert>}
        <p className="text-sm text-ink-sub">
          テレマが取ったアポは営業からは変えられません。依頼はテレマ全員に届き、対応する人が日時を変えます。
        </p>
        <FormField
          label="依頼の内容"
          required
          hint="例：先方都合で、10/20（火）の午後に変更をお願いします。"
        >
          {(c) => (
            <Textarea
              {...c}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          )}
        </FormField>
      </div>
    </Dialog>
  );
}

export function EditDetailsDialog({ appointment, onClose }: DialogProps) {
  const update = useUpdateAppointment(appointment.id);
  const [values, setValues] = useState<AppointmentValues>({
    format: appointment.format,
    visitAddress: appointment.visitAddress ?? '',
    contactName: appointment.contactName ?? '',
    contactDepartment: appointment.contactDepartment ?? '',
    contactPhone: appointment.contactPhone ?? '',
    contactEmail: appointment.contactEmail ?? '',
    handoverNotes: appointment.handoverNotes ?? '',
    customerType: appointment.customerType ?? '',
    listName: appointment.listName ?? '',
    isNewAppointment: appointment.isNewAppointment,
    bookedById: '',
    bookedOn: '',
  });
  const submit = () =>
    update.mutate(
      {
        expectedVersion: appointment.version,
        format: values.format || appointment.format,
        visitAddress: values.visitAddress || null,
        contactName: values.contactName || null,
        contactDepartment: values.contactDepartment || null,
        contactPhone: values.contactPhone || null,
        contactEmail: values.contactEmail || null,
        handoverNotes: values.handoverNotes || null,
        customerType: values.customerType || null,
        listName: values.listName || null,
        isNewAppointment: values.isNewAppointment,
      },
      { onSuccess: onClose },
    );
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="アポの内容を編集"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button loading={update.isPending} onClick={submit}>
            保存する
          </Button>
        </>
      }
    >
      {update.isError && (
        <Alert tone="error" className="mb-4">
          {errorMessageOf(update.error)}
        </Alert>
      )}
      <AppointmentFields values={values} onChange={setValues} />
      <p className="mt-4 text-xs text-ink-sub">
        メール（N1）を送ったあとに内容を直した場合は、メール画面から【再送】できます。
      </p>
    </Dialog>
  );
}

export function MeetingUrlForm({ appointment }: { appointment: AppointmentDetail }) {
  const save = useMeetingUrl(appointment.id);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(appointment.meetingUrl ?? '');
  if (!editing) {
    return (
      <div className="flex flex-col gap-2">
        {appointment.meetingUrl ? (
          <a
            href={appointment.meetingUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm break-all text-link hover:underline"
          >
            {appointment.meetingUrl}
          </a>
        ) : (
          <p className="text-sm text-ink-sub">
            {appointment.format === 'ONLINE'
              ? '会議URLはまだ登録されていません。'
              : '訪問のため不要です（オンラインに変えたときは登録してください）。'}
          </p>
        )}
        {appointment.abilities.editMeetingUrl && (
          <div>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {appointment.meetingUrl ? 'URLを変更' : 'URLを登録'}
            </Button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {save.isError && <Alert tone="error">URLは https:// から入力してください。</Alert>}
      <TextInput
        type="url"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://teams.microsoft.com/…"
        aria-label="会議URL"
      />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setEditing(false)}>
          キャンセル
        </Button>
        <Button
          loading={save.isPending}
          onClick={() => save.mutate(value.trim() || null, { onSuccess: () => setEditing(false) })}
        >
          保存する
        </Button>
      </div>
    </div>
  );
}
