import {
  addDays,
  OptionCategory,
  type PlanDto,
  type PlanRequest,
  PlanStatus,
  Role,
} from '@telesales/shared';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { TextInput } from '@/components/ui/TextInput';
import { useOptionList, usePeople } from '@/features/reference/useReference';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { defaultEndTime, formatTime, timeOptions, toInstant } from '@/lib/format';
import { jstDate } from '@telesales/shared';
import { useSavePlan } from './api';
import { slotProblemText } from './slotProblems';

interface PlanDialogProps {
  open: boolean;
  onClose: () => void;
  /** Editing an existing plan, or defaults for a new one. */
  plan?: PlanDto;
  defaults?: { ownerId: string; date: string; time?: string };
}

const TIMES = timeOptions(6, 22).map((time) => ({ value: time, label: time }));

/** Sales plans other than appointments (spec §6): own and other reps, attendees, repeats. */
export function PlanDialog({ open, onClose, plan, defaults }: PlanDialogProps) {
  const save = useSavePlan();
  const types = useOptionList(OptionCategory.PlanType);
  const people = usePeople();
  const sales = usePeople(Role.Sales);
  const initialDate = plan ? jstDate(new Date(plan.startsAt)) : (defaults?.date ?? '');
  const [values, setValues] = useState({
    ownerId: plan?.owner.id ?? defaults?.ownerId ?? '',
    type: plan?.type ?? 'INTERNAL',
    title: plan?.title ?? '',
    date: initialDate,
    endDate: plan ? jstDate(new Date(new Date(plan.endsAt).getTime() - 1)) : initialDate,
    start: plan && !plan.allDay ? formatTime(plan.startsAt) : (defaults?.time ?? '10:00'),
    end: plan && !plan.allDay ? formatTime(plan.endsAt) : defaultEndTime(defaults?.time ?? '10:00'),
    allDay: plan?.allDay ?? false,
    status: plan?.status ?? PlanStatus.Fixed,
    holidayWork: plan?.holidayWork ?? false,
    note: plan?.note ?? '',
    attendeeIds: plan?.attendees.map((attendee) => attendee.id) ?? [],
    repeatWeeks: 1,
  });
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const submit = () => {
    const startsAt = values.allDay
      ? toInstant(values.date, '00:00')
      : toInstant(values.date, values.start);
    const endsAt = values.allDay
      ? toInstant(addDays(values.endDate < values.date ? values.date : values.endDate, 1), '00:00')
      : toInstant(values.date, values.end);
    const request: PlanRequest = {
      ownerId: values.ownerId,
      type: values.type,
      title: values.title,
      startsAt,
      endsAt,
      allDay: values.allDay,
      status: values.status,
      holidayWork: values.holidayWork,
      note: values.note,
      attendeeIds: values.attendeeIds,
      candidateGroupId: plan?.candidateGroupId ?? null,
      repeat: !plan && values.repeatWeeks > 1 ? { weeklyCount: values.repeatWeeks } : null,
    };
    save.mutate({ id: plan?.id, request }, { onSuccess: onClose });
  };

  const others = (people.data ?? []).filter((person) => person.id !== values.ownerId);
  const problems = (save.error as { details?: unknown } | null)?.details;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={plan ? '予定の変更' : '予定を追加'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            onClick={submit}
            loading={save.isPending}
            disabled={!values.ownerId || !values.title.trim() || !values.date}
          >
            保存する
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {save.isError && (
          <Alert tone="error">
            {errorMessageOf(save.error)}
            {Array.isArray(problems) && (
              <ul className="mt-1 list-inside list-disc">
                {problems.map((problem, index) => (
                  <li key={index}>{slotProblemText(problem)}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="誰の予定" required>
            {(c) => (
              <Select
                {...c}
                value={values.ownerId}
                placeholder="選択してください"
                options={(sales.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                onChange={(e) => set('ownerId', e.target.value)}
              />
            )}
          </FormField>
          <FormField label="種別" required>
            {(c) => (
              <Select
                {...c}
                value={values.type}
                options={types.selectOptions}
                onChange={(e) => set('type', e.target.value)}
              />
            )}
          </FormField>
        </div>
        <FormField label="会社名またはタイトル" required>
          {(c) => (
            <TextInput
              {...c}
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              maxLength={200}
            />
          )}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <FormField label="日付" required>
              {(c) => (
                <TextInput
                  {...c}
                  type="date"
                  value={values.date}
                  onChange={(e) => set('date', e.target.value)}
                />
              )}
            </FormField>
          </div>
          {values.allDay ? (
            <div className="sm:col-span-2">
              <FormField label="終了日">
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
            </div>
          ) : (
            <>
              <FormField label="開始">
                {(c) => (
                  <Select
                    {...c}
                    value={values.start}
                    options={TIMES}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        start: e.target.value,
                        end: defaultEndTime(e.target.value),
                      }))
                    }
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
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-x-6">
          <Checkbox
            label="終日"
            checked={values.allDay}
            onChange={(e) => set('allDay', e.target.checked)}
          />
          <Checkbox
            label="仮予定（候補日）"
            checked={values.status === PlanStatus.Tentative}
            onChange={(e) =>
              set('status', e.target.checked ? PlanStatus.Tentative : PlanStatus.Fixed)
            }
          />
          <Checkbox
            label="休日出勤（土日祝にも入れる）"
            checked={values.holidayWork}
            onChange={(e) => set('holidayWork', e.target.checked)}
          />
        </div>
        <fieldset>
          <legend className="mb-1 text-sm font-bold">同席者</legend>
          <div className="flex max-h-36 flex-wrap gap-x-5 overflow-y-auto">
            {others.map((person) => (
              <Checkbox
                key={person.id}
                label={person.name}
                checked={values.attendeeIds.includes(person.id)}
                onChange={(e) =>
                  set(
                    'attendeeIds',
                    e.target.checked
                      ? [...values.attendeeIds, person.id]
                      : values.attendeeIds.filter((id) => id !== person.id),
                  )
                }
              />
            ))}
          </div>
        </fieldset>
        {!plan && (
          <FormField label="繰り返し" hint="同じ曜日・時刻で毎週入れます。">
            {(c) => (
              <Select
                {...c}
                value={String(values.repeatWeeks)}
                options={[1, 2, 3, 4, 6, 8, 12, 26, 52].map((n) => ({
                  value: String(n),
                  label: n === 1 ? '繰り返さない' : `毎週 ${n}回`,
                }))}
                onChange={(e) => set('repeatWeeks', Number(e.target.value))}
              />
            )}
          </FormField>
        )}
        <FormField label="メモ">
          {(c) => (
            <Textarea
              {...c}
              rows={2}
              value={values.note}
              onChange={(e) => set('note', e.target.value)}
            />
          )}
        </FormField>
      </div>
    </Dialog>
  );
}
