import {
  addDays,
  OptionCategory,
  type PlanDto,
  type PlanRequest,
  PlanStatus,
  Role,
} from '@telesales/shared';
import { AlignLeft, Clock, Repeat, Tag, UserRound, Users } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { DatePicker } from '@/components/ui/DatePicker';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { TimePicker } from '@/components/ui/TimePicker';
import { Textarea } from '@/components/ui/Textarea';
import { useOptionList, usePeople } from '@/features/reference/useReference';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { defaultEndTime, formatTime, toInstant } from '@/lib/format';
import { jstDate } from '@telesales/shared';
import { useSavePlan } from './api';
import { Avatar } from './calendar/Avatar';
import { personColor } from './calendar/people';
import { slotProblemText } from './slotProblems';

interface PlanDialogProps {
  open: boolean;
  onClose: () => void;
  /** Editing an existing plan, or defaults for a new one. */
  plan?: PlanDto;
  defaults?: { ownerId: string; date: string; time?: string; endTime?: string };
}

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
    end:
      plan && !plan.allDay
        ? formatTime(plan.endsAt)
        : (defaults?.endTime ?? defaultEndTime(defaults?.time ?? '10:00')),
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

  const order = (people.data ?? []).map((person) => person.id);
  const toggleAttendee = (id: string) =>
    set(
      'attendeeIds',
      values.attendeeIds.includes(id)
        ? values.attendeeIds.filter((x) => x !== id)
        : [...values.attendeeIds, id],
    );

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
      <div className="flex flex-col gap-1">
        {save.isError && (
          <Alert tone="error" className="mb-3">
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

        {/* Title first and large, as in a desk calendar. */}
        <input
          autoFocus
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          maxLength={200}
          aria-label="会社名またはタイトル"
          aria-required
          placeholder="会社名またはタイトルを入力"
          className="mb-2 h-12 w-full border-0 border-b-2 border-line bg-transparent px-0.5 text-xl font-bold placeholder:font-normal placeholder:text-ink-disabled focus:border-main focus:outline-none"
        />

        <Row icon={<Tag className="size-4" />} label="種別">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="種別">
            {types.selectOptions.map((option) => {
              const on = values.type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set('type', option.value)}
                  className={cn(
                    'h-8 cursor-pointer border px-3 text-sm transition-colors',
                    on
                      ? 'border-schedule bg-schedule-soft font-bold text-schedule'
                      : 'border-line text-ink-sub hover:border-line-strong hover:text-ink',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </Row>

        <Row icon={<Clock className="size-4" />} label="日時">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <DatePicker
                aria-label="日付"
                className="w-60"
                value={values.date}
                onChange={(e) => set('date', e.target.value)}
              />
              {values.allDay ? (
                <>
                  <span className="text-ink-sub">〜</span>
                  <DatePicker
                    aria-label="終了日"
                    className="w-60"
                    value={values.endDate}
                    min={values.date}
                    onChange={(e) => set('endDate', e.target.value)}
                  />
                </>
              ) : (
                <>
                  <TimePicker
                    aria-label="開始"
                    className="w-28"
                    fromHour={6}
                    toHour={22}
                    value={values.start}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        start: e.target.value,
                        end: defaultEndTime(e.target.value),
                      }))
                    }
                  />
                  <span className="text-ink-sub">〜</span>
                  <TimePicker
                    aria-label="終了"
                    className="w-40"
                    fromHour={6}
                    toHour={22}
                    after={values.start}
                    durationFrom={values.start}
                    value={values.end}
                    onChange={(e) => set('end', e.target.value)}
                  />
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6">
              <Switch label="終日" checked={values.allDay} onChange={(v) => set('allDay', v)} />
              <Switch
                label="仮予定（候補日）"
                checked={values.status === PlanStatus.Tentative}
                onChange={(v) => set('status', v ? PlanStatus.Tentative : PlanStatus.Fixed)}
              />
              <Switch
                label="休日出勤"
                description="土日祝にも入れる"
                checked={values.holidayWork}
                onChange={(v) => set('holidayWork', v)}
              />
            </div>
          </div>
        </Row>

        <Row icon={<UserRound className="size-4" />} label="誰の予定">
          <Select
            aria-label="誰の予定"
            aria-required
            className="max-w-xs"
            value={values.ownerId}
            placeholder="選択してください"
            options={(sales.data ?? []).map((p) => ({
              value: p.id,
              label: p.name,
              icon: <Avatar size="sm" name={p.name} color={personColor(p.id, order)} />,
            }))}
            onChange={(e) => set('ownerId', e.target.value)}
          />
        </Row>

        <Row
          icon={<Users className="size-4" />}
          label={`同席者${values.attendeeIds.length ? `（${values.attendeeIds.length}人）` : ''}`}
        >
          <div
            className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto"
            role="group"
            aria-label="同席者"
          >
            {others.map((person) => {
              const on = values.attendeeIds.includes(person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleAttendee(person.id)}
                  className={cn(
                    'flex h-8 cursor-pointer items-center gap-1.5 border pr-3 pl-1 text-sm transition-colors',
                    on
                      ? 'border-success/50 bg-success-soft font-bold text-ink'
                      : 'border-line text-ink-sub hover:border-line-strong hover:text-ink',
                  )}
                >
                  <Avatar
                    size="sm"
                    name={person.name}
                    color={personColor(person.id, order)}
                    className={cn(!on && 'opacity-50')}
                  />
                  {person.name}
                </button>
              );
            })}
          </div>
        </Row>

        {!plan && (
          <Row icon={<Repeat className="size-4" />} label="繰り返し">
            <Select
              aria-label="繰り返し"
              className="max-w-xs"
              value={String(values.repeatWeeks)}
              options={[1, 2, 3, 4, 6, 8, 12, 26, 52].map((n) => ({
                value: String(n),
                label: n === 1 ? '繰り返さない' : `毎週 ${n}回（同じ曜日・時刻）`,
              }))}
              onChange={(e) => set('repeatWeeks', Number(e.target.value))}
            />
          </Row>
        )}

        <Row icon={<AlignLeft className="size-4" />} label="メモ">
          <Textarea
            aria-label="メモ"
            rows={2}
            placeholder="持ち物・場所・共有したいこと"
            value={values.note}
            onChange={(e) => set('note', e.target.value)}
          />
        </Row>
      </div>
    </Dialog>
  );
}

/** One line of the editor: an icon, a small label and the control. */
function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1.75rem_1fr] gap-x-3 border-b border-line/70 py-3 last:border-b-0">
      <span aria-hidden="true" className="pt-2 text-ink-sub">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-xs font-bold text-ink-sub">{label}</span>
        {children}
      </div>
    </div>
  );
}
