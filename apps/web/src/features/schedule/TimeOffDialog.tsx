import { addDays, type TimeOffKind, TimeOffKind as Kind } from '@telesales/shared';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';
import { usePeople } from '@/features/reference/useReference';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { timeOptions, toInstant } from '@/lib/format';
import { ja } from '@/i18n/ja';
import { useSaveTimeOff } from './api';

const TIMES = timeOptions(6, 22).map((time) => ({ value: time, label: time }));

/**
 * Time off, late start, early leave — also for other people who called in (spec §7) —
 * and テレマアポ停止 (Q-07): a period and a daily time band that telemarketing sees as
 * taken (営業枠) while the rep can still put their own plans in it.
 */
export function TimeOffDialog({
  open,
  onClose,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  defaults: { userId: string; date: string };
}) {
  const save = useSaveTimeOff();
  const people = usePeople();
  const [values, setValues] = useState({
    userId: defaults.userId,
    kind: Kind.DayOff as TimeOffKind,
    date: defaults.date,
    endDate: defaults.date,
    start: '09:00',
    end: '12:00',
    note: '',
  });
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const allDay = values.kind === Kind.DayOff;
  const stop = values.kind === Kind.TelemaStop;
  const lastDay = values.endDate < values.date ? values.date : values.endDate;

  const submit = () => {
    const startsAt = allDay
      ? toInstant(values.date, '00:00')
      : toInstant(values.date, values.start);
    const endsAt = allDay
      ? toInstant(addDays(lastDay, 1), '00:00')
      : toInstant(values.date, values.end);
    save.mutate(
      {
        userId: values.userId,
        kind: values.kind,
        startsAt,
        endsAt,
        allDay,
        note: values.note,
        // テレマアポ停止: the same time band on every day of the period.
        repeatUntil: stop && lastDay > values.date ? lastDay : null,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="休み・遅刻・早退・テレマアポ停止を入力"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            onClick={submit}
            loading={save.isPending}
            disabled={!values.userId || !values.date}
          >
            保存する
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {save.isError && <Alert tone="error">{errorMessageOf(save.error)}</Alert>}
        <FormField label="誰の予定" required>
          {(c) => (
            <Select
              {...c}
              value={values.userId}
              placeholder="選択してください"
              options={(people.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
              onChange={(e) => set('userId', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="種類" required>
          {(c) => (
            <Select
              {...c}
              value={values.kind}
              options={Object.values(Kind).map((kind) => ({
                value: kind,
                label: ja.timeOff[kind],
              }))}
              onChange={(e) => set('kind', e.target.value as TimeOffKind)}
            />
          )}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={allDay || stop ? '開始日' : '日付'} required>
            {(c) => (
              <TextInput
                {...c}
                type="date"
                value={values.date}
                onChange={(e) =>
                  setValues((v) => ({ ...v, date: e.target.value, endDate: e.target.value }))
                }
              />
            )}
          </FormField>
          {(allDay || stop) && (
            <FormField
              label="終了日"
              hint={stop ? '期間中は毎日、下の時間帯が営業枠になります。' : undefined}
            >
              {(c) => (
                <TextInput
                  {...c}
                  type="date"
                  value={values.endDate}
                  min={values.date}
                  onChange={(e) => set('endDate', e.target.value)}
                />
              )}
            </FormField>
          )}
        </div>
        {!allDay && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="開始">
              {(c) => (
                <Select
                  {...c}
                  value={values.start}
                  options={TIMES}
                  onChange={(e) => set('start', e.target.value)}
                />
              )}
            </FormField>
            <FormField label="終了">
              {(c) => (
                <Select
                  {...c}
                  value={values.end}
                  options={TIMES.filter((t) => t.value > values.start)}
                  onChange={(e) => set('end', e.target.value)}
                />
              )}
            </FormField>
          </div>
        )}
        {stop && (
          <Alert tone="info">
            テレマの画面ではこの時間が「埋まり（営業枠）」になり、アポを入れられません。自分の予定は入れられます。
          </Alert>
        )}
        <FormField label="メモ" hint="例：電話で連絡あり（受けた人が入力）">
          {(c) => (
            <TextInput
              {...c}
              value={values.note}
              maxLength={200}
              onChange={(e) => set('note', e.target.value)}
            />
          )}
        </FormField>
      </div>
    </Dialog>
  );
}
