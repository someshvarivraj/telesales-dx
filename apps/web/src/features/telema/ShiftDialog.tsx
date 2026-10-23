import { type ShiftDto, ShiftKind } from '@telesales/shared';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { TimePicker } from '@/components/ui/TimePicker';
import { TextInput } from '@/components/ui/TextInput';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDate } from '@/lib/format';
import { useDeleteShift, useSaveShift } from './api';
import { formatMinutes } from './telemaAccess';

const BREAKS = [0, 15, 30, 45, 60, 75, 90, 120].map((minutes) => ({
  value: String(minutes),
  label: `${minutes}分`,
}));

function minutesBetween(start: string, end: string, breakMinutes: number): number {
  const toMinutes = (time: string) => {
    const [h = 0, m = 0] = time.split(':').map(Number);
    return h * 60 + m;
  };
  return Math.max(0, toMinutes(end) - toMinutes(start) - breakMinutes);
}

interface ShiftDialogProps {
  open: boolean;
  onClose: () => void;
  person: { id: string; name: string };
  date: string;
  shift: ShiftDto | null;
  /** Usual hours, used as the starting point for a new working day. */
  usual: { start: string | null; end: string | null; breakMinutes: number };
}

/** One person's day: working hours and break, or off. Late / early leave = change the times. */
export function ShiftDialog({ open, onClose, person, date, shift, usual }: ShiftDialogProps) {
  const save = useSaveShift();
  const remove = useDeleteShift();
  const [kind, setKind] = useState<ShiftKind>(shift?.kind ?? ShiftKind.Work);
  const [start, setStart] = useState(shift?.startTime ?? usual.start ?? '09:00');
  const [end, setEnd] = useState(shift?.endTime ?? usual.end ?? '18:00');
  const [breakMinutes, setBreakMinutes] = useState(shift?.breakMinutes ?? usual.breakMinutes);
  const [note, setNote] = useState(shift?.note ?? '');
  const work = kind === ShiftKind.Work;
  const invalid = work && end <= start;
  const error = save.error ?? remove.error;

  const submit = () =>
    save.mutate(
      {
        userId: person.id,
        date,
        kind,
        startTime: work ? start : null,
        endTime: work ? end : null,
        breakMinutes: work ? breakMinutes : 0,
        note: note.trim() || null,
      },
      { onSuccess: onClose },
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${person.name}さん　${formatDate(date)}`}
      footer={
        <>
          {shift && (
            <Button
              variant="danger"
              className="mr-auto"
              loading={remove.isPending}
              onClick={() => remove.mutate(shift.id, { onSuccess: onClose })}
            >
              消去
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button loading={save.isPending} disabled={invalid} onClick={submit}>
            保存する
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert tone="error">{errorMessageOf(error)}</Alert>}
        <fieldset className="flex gap-6">
          <legend className="mb-1 text-sm font-bold">区分</legend>
          <Checkbox
            type="radio"
            name="kind"
            label="出勤"
            checked={work}
            onChange={() => setKind(ShiftKind.Work)}
          />
          <Checkbox
            type="radio"
            name="kind"
            label="休み"
            checked={!work}
            onChange={() => setKind(ShiftKind.Off)}
          />
        </fieldset>
        {work && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="開始">
                {(c) => (
                  <TimePicker
                    {...c}
                    value={start}
                    fromHour={6}
                    toHour={23}
                    onChange={(e) => setStart(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="終了" error={invalid ? '開始より後にしてください' : undefined}>
                {(c) => (
                  <TimePicker
                    {...c}
                    value={end}
                    fromHour={6}
                    toHour={23}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="休憩">
                {(c) => (
                  <Select
                    {...c}
                    value={String(breakMinutes)}
                    options={BREAKS}
                    onChange={(e) => setBreakMinutes(Number(e.target.value))}
                  />
                )}
              </FormField>
            </div>
            <p className="text-sm text-ink-sub">
              稼働時間：{formatMinutes(minutesBetween(start, end, breakMinutes))}
              （遅刻・早退は時間を変えて入れます）
            </p>
          </>
        )}
        <FormField label="メモ" hint="例：本人から電話（体調不良）">
          {(c) => (
            <TextInput
              {...c}
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </FormField>
      </div>
    </Dialog>
  );
}
