import {
  addDays,
  isWeekend,
  OptionCategory,
  PLAN_TYPES_WITH_COMPANY,
  type PlanDto,
  type PlanRequest,
  PlanStatus,
  Role,
} from '@telesales/shared';
import {
  AlignLeft,
  Building2,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Repeat,
  Tag,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { type ReactNode, useDeferredValue, useId, useMemo, useState } from 'react';
import { DatePicker } from '@/components/ui/DatePicker';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';
import { DraftNotice, ResetButton } from '@/components/ui/DraftBar';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { TextInput } from '@/components/ui/TextInput';
import { TimePicker } from '@/components/ui/TimePicker';
import { useCompanySearch } from '@/features/calls/api';
import { Textarea } from '@/components/ui/Textarea';
import { useOptionList, usePeople } from '@/features/reference/useReference';
import { errorMessageOf } from '@/lib/api/errorMessage';
import {
  defaultPlanEndTime,
  formatShortDate,
  formatTime,
  startOfWeek,
  todayJst,
  toInstant,
} from '@/lib/format';
import { useDraft } from '@/lib/drafts';
import { jstDate } from '@telesales/shared';
import { useSavePlan, useSchedule } from './api';
import { freeRanges, hhmm, toMinutes } from './calendar/layout';
import { buildEvents, eventsOn } from './events';
import { AttendeePicker } from './AttendeePicker';
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
  // Kept through a refresh until saved (request 11/2).
  const draft = useDraft(
    `plan:${plan?.id ?? `new:${defaults?.ownerId ?? ''}:${defaults?.date ?? ''}`}`,
    {
      ownerId: plan?.owner.id ?? defaults?.ownerId ?? '',
      type: plan?.type ?? 'INTERNAL',
      // An old visit kept the company as its title: start with an empty 件名 then.
      title: plan && plan.title !== plan.companyName ? plan.title : '',
      companyName: plan?.companyName ?? '',
      date: initialDate,
      endDate: plan ? jstDate(new Date(new Date(plan.endsAt).getTime() - 1)) : initialDate,
      start: plan && !plan.allDay ? formatTime(plan.startsAt) : (defaults?.time ?? '10:00'),
      end:
        plan && !plan.allDay
          ? formatTime(plan.endsAt)
          : (defaults?.endTime ?? defaultPlanEndTime(defaults?.time ?? '10:00')),
      allDay: plan?.allDay ?? false,
      status: plan?.status ?? PlanStatus.Fixed,
      holidayWork: plan?.holidayWork ?? false,
      note: plan?.note ?? '',
      attendeeIds: plan?.attendees.map((attendee) => attendee.id) ?? [],
      repeatWeeks: 1,
      /** More candidate dates for a new 仮予定 (request 11/12). */
      candidates: [] as Candidate[],
    },
  );
  const values = draft.value;
  const setValues = draft.set;
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const withCompany = PLAN_TYPES_WITH_COMPANY.includes(values.type);
  // Several candidate dates: only for a new, timed 仮予定.
  const canAddCandidates = !plan && values.status === PlanStatus.Tentative && !values.allDay;
  // A draft saved before 候補日 existed has none.
  const candidates = values.candidates ?? [];
  const withCandidates = canAddCandidates && candidates.length > 0;
  const candidatesValid = candidates.every((slot) => slot.date && slot.end > slot.start);

  const submit = () => {
    const startsAt = values.allDay
      ? toInstant(values.date, '00:00')
      : toInstant(values.date, values.start);
    const endsAt = values.allDay
      ? toInstant(addDays(values.endDate < values.date ? values.date : values.endDate, 1), '00:00')
      : toInstant(values.date, values.end);
    const company = withCompany ? values.companyName.trim() : '';
    const request: PlanRequest = {
      ownerId: values.ownerId,
      type: values.type,
      // A visit needs no separate 件名: the company name stands in.
      title: values.title.trim() || company,
      companyName: company || null,
      startsAt,
      endsAt,
      allDay: values.allDay,
      status: values.status,
      holidayWork: values.holidayWork,
      note: values.note,
      attendeeIds: values.attendeeIds,
      candidateGroupId: plan?.candidateGroupId ?? null,
      repeat:
        !plan && !withCandidates && values.repeatWeeks > 1
          ? { weeklyCount: values.repeatWeeks }
          : null,
      candidates: withCandidates
        ? candidates.map((slot) => ({
            startsAt: toInstant(slot.date, slot.start),
            endsAt: toInstant(slot.date, slot.end),
          }))
        : null,
    };
    save.mutate(
      { id: plan?.id, request },
      {
        onSuccess: () => {
          draft.reset();
          onClose();
        },
      },
    );
  };

  const problems = (save.error as { details?: unknown } | null)?.details;

  const order = (people.data ?? []).map((person) => person.id);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={plan ? '予定の変更' : '予定を追加'}
      size="lg"
      movable
      footer={
        <>
          <ResetButton dirty={draft.dirty} onReset={draft.reset} className="mr-auto" />
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            onClick={submit}
            loading={save.isPending}
            disabled={
              !values.ownerId ||
              !(values.title.trim() || (withCompany && values.companyName.trim())) ||
              !values.date ||
              (withCandidates && !candidatesValid)
            }
          >
            {withCandidates ? `候補${candidates.length + 1}件を保存する` : '保存する'}
          </Button>
        </>
      }
    >
      <DraftNotice restoredAt={draft.restoredAt} onReset={draft.reset} className="mb-4" />
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

        {/* 件名 first and large, as in a desk calendar. */}
        <input
          autoFocus
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          maxLength={200}
          aria-label="件名"
          aria-required={!withCompany}
          placeholder={
            withCompany ? '件名（任意。例：初回ご挨拶、提案）' : '件名（例：社内会議、資料作成）'
          }
          className="mb-2 h-12 w-full border-0 border-b-2 border-line bg-transparent px-0.5 text-xl font-bold placeholder:font-normal placeholder:text-ink-disabled focus:border-main focus:outline-none"
        />

        <Row icon={<Tag className="size-4" />} label="種別">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="種別">
            {types.selectOptions
              // Customer meetings are booked with 「自分で取ったアポを登録」; 予定 are the rep's own
              // tasks (feedback 11/11). An older visit keeps its type when it is edited.
              .filter(
                (option) =>
                  !PLAN_TYPES_WITH_COMPANY.includes(option.value) || plan?.type === option.value,
              )
              .map((option) => {
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
          {!withCompany && (
            <p className="mt-1.5 text-xs text-ink-sub">
              お客様とのアポ（訪問・オンライン）は「自分で取ったアポを登録」から入れてください。
            </p>
          )}
        </Row>

        {withCompany && (
          <Row
            icon={<Building2 className="size-4" />}
            label={values.type === 'ONLINE' ? '相手の会社' : '訪問先の会社'}
          >
            <CompanyField value={values.companyName} onChange={(v) => set('companyName', v)} />
          </Row>
        )}

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
                        end: defaultPlanEndTime(e.target.value),
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

        {canAddCandidates && (
          <Row
            icon={<CalendarPlus className="size-4" />}
            label={`候補日（${candidates.length + 1}件・1つを確定すると、残りは消えます）`}
          >
            <CandidateEditor
              ownerId={values.ownerId}
              first={{ date: values.date, start: values.start, end: values.end }}
              candidates={candidates}
              onChange={(next) => set('candidates', next)}
            />
          </Row>
        )}

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
          <AttendeePicker
            ownerId={values.ownerId}
            value={values.attendeeIds}
            onChange={(ids) => set('attendeeIds', ids)}
          />
        </Row>

        {!plan && !withCandidates && (
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

/** The other company: typed freely, with registered companies suggested as you type. */
function CompanyField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const listId = useId();
  const keyword = useDeferredValue(value.trim());
  const search = useCompanySearch(
    { keyword, callTargetsOnly: false, page: 1, pageSize: 8 },
    { enabled: keyword.length >= 2 },
  );
  const names = [...new Set((search.data?.items ?? []).map((company) => company.name))];
  return (
    <>
      <TextInput
        aria-label="会社名"
        className="max-w-md"
        value={value}
        maxLength={200}
        list={listId}
        autoComplete="off"
        placeholder="会社名を入力（登録済みの会社は候補に出ます）"
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {keyword.length >= 2 && names.map((name) => <option key={name} value={name} />)}
      </datalist>
    </>
  );
}

interface Candidate {
  date: string;
  start: string;
  end: string;
}

const MAX_CANDIDATES = 9;
const DAYS_SHOWN = 5;

/**
 * 候補日 (request 11/12, 営業部): several candidate dates for one 仮予定, added with ＋ or picked
 * from the rep's free time in the week, so a meeting can be offered to a company in one go.
 */
function CandidateEditor({
  ownerId,
  first,
  candidates,
  onChange,
}: {
  ownerId: string;
  first: Candidate;
  candidates: Candidate[];
  onChange: (next: Candidate[]) => void;
}) {
  const [picking, setPicking] = useState(false);
  const all = [first, ...candidates];
  const length = Math.max(15, toMinutes(first.end) - toMinutes(first.start));
  const full = candidates.length >= MAX_CANDIDATES;
  const update = (index: number, patch: Partial<Candidate>) =>
    onChange(candidates.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  const nextDay = () => {
    let day = addDays(all[all.length - 1]?.date || first.date, 1);
    while (isWeekend(day)) day = addDays(day, 1);
    return day;
  };
  const taken = (slot: Candidate) =>
    all.some((c) => c.date === slot.date && c.start === slot.start && c.end === slot.end);

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-1.5">
        <li className="flex flex-wrap items-center gap-2 text-sm">
          <span className="flex size-6 items-center justify-center bg-ev-tentative-soft text-xs font-bold text-ev-tentative">
            1
          </span>
          <span className="font-medium">
            {first.date ? formatShortDate(first.date) : '―'} {first.start}〜{first.end}
          </span>
          <span className="text-xs text-ink-sub">（上の日時）</span>
        </li>
        {candidates.map((slot, index) => (
          <li key={index} className="flex flex-wrap items-center gap-2">
            <span className="flex size-6 items-center justify-center bg-ev-tentative-soft text-xs font-bold text-ev-tentative">
              {index + 2}
            </span>
            <DatePicker
              aria-label={`候補${index + 2}の日付`}
              className="w-60"
              value={slot.date}
              onChange={(e) => update(index, { date: e.target.value })}
            />
            <TimePicker
              aria-label={`候補${index + 2}の開始`}
              className="w-28"
              fromHour={6}
              toHour={22}
              value={slot.start}
              onChange={(e) =>
                update(index, {
                  start: e.target.value,
                  end: hhmm(Math.min(24 * 60, toMinutes(e.target.value) + length)),
                })
              }
            />
            <span className="text-ink-sub">〜</span>
            <TimePicker
              aria-label={`候補${index + 2}の終了`}
              className="w-40"
              fromHour={6}
              toHour={22}
              after={slot.start}
              durationFrom={slot.start}
              value={slot.end}
              onChange={(e) => update(index, { end: e.target.value })}
            />
            <button
              type="button"
              aria-label={`候補${index + 2}を外す`}
              onClick={() => onChange(candidates.filter((_, i) => i !== index))}
              className="flex size-8 cursor-pointer items-center justify-center text-ink-sub hover:bg-column hover:text-danger"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={full}
          icon={<Plus className="size-4" aria-hidden="true" />}
          onClick={() =>
            onChange([...candidates, { date: nextDay(), start: first.start, end: first.end }])
          }
        >
          候補日を追加
        </Button>
        <Button
          size="sm"
          variant={picking ? 'primary' : 'secondary'}
          disabled={!ownerId}
          icon={<CalendarPlus className="size-4" aria-hidden="true" />}
          onClick={() => setPicking((v) => !v)}
        >
          空き時間から選ぶ
        </Button>
        {full && <span className="self-center text-xs text-ink-sub">候補は10件までです。</span>}
      </div>
      {picking && ownerId && (
        <FreeSlotPicker
          ownerId={ownerId}
          from={first.date || todayJst()}
          length={length}
          isTaken={taken}
          disabled={full}
          onPick={(slot) => onChange([...candidates, slot])}
        />
      )}
    </div>
  );
}

/** The rep's free time (9:00–18:00) day by day; a click adds that time as a candidate. */
function FreeSlotPicker({
  ownerId,
  from,
  length,
  isTaken,
  disabled,
  onPick,
}: {
  ownerId: string;
  from: string;
  length: number;
  isTaken: (slot: Candidate) => boolean;
  disabled: boolean;
  onPick: (slot: Candidate) => void;
}) {
  const [week, setWeek] = useState(() => startOfWeek(from));
  const last = addDays(week, DAYS_SHOWN - 1);
  const schedule = useSchedule(week, last, [ownerId]);
  const events = useMemo(() => (schedule.data ? buildEvents(schedule.data) : []), [schedule.data]);
  const today = todayJst();
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(week, i));
  const holiday = (date: string) => schedule.data?.holidays.find((day) => day.date === date)?.name;

  return (
    <div className="border border-line bg-canvas p-3">
      <div className="mb-2 flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          aria-label="前の週"
          disabled={week <= startOfWeek(today)}
          icon={<ChevronLeft className="size-4" aria-hidden="true" />}
          onClick={() => setWeek(addDays(week, -7))}
        />
        <span className="text-sm font-bold">
          {formatShortDate(week)}〜{formatShortDate(last)}の空き時間
        </span>
        <Button
          size="sm"
          variant="secondary"
          aria-label="次の週"
          icon={<ChevronRight className="size-4" aria-hidden="true" />}
          onClick={() => setWeek(addDays(week, 7))}
        />
      </div>
      {!schedule.data ? (
        <p className="text-sm text-ink-sub">読み込み中…</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {days.map((date) => {
            const name = holiday(date);
            const free =
              date < today || name
                ? []
                : freeRanges(eventsOn(events, date, ownerId), date, { min: Math.min(length, 60) });
            return (
              <li key={date} className="grid grid-cols-[5.5rem_1fr] items-start gap-2">
                <span className="pt-1 text-sm font-bold">{formatShortDate(date)}</span>
                <div className="flex flex-wrap gap-1.5">
                  {name ? (
                    <span className="pt-1 text-xs text-sunday">{name}</span>
                  ) : date < today ? (
                    <span className="pt-1 text-xs text-ink-disabled">過ぎた日</span>
                  ) : free.length === 0 ? (
                    <span className="pt-1 text-xs text-ink-sub">空きなし</span>
                  ) : (
                    free.map(([start, end]) => {
                      const slot = {
                        date,
                        start: hhmm(start),
                        end: hhmm(Math.min(end, start + length)),
                      };
                      const on = isTaken(slot);
                      return (
                        <button
                          key={start}
                          type="button"
                          disabled={disabled || on}
                          onClick={() => onPick(slot)}
                          title={`${hhmm(start)}〜${hhmm(end)} が空いています`}
                          className={cn(
                            'h-7 cursor-pointer border px-2 text-xs tabular-nums transition-colors disabled:cursor-not-allowed',
                            on
                              ? 'border-ev-tentative bg-ev-tentative-soft font-bold text-ev-tentative'
                              : 'border-free-ink/30 bg-free text-free-ink hover:border-free-ink disabled:opacity-50',
                          )}
                        >
                          {on ? '✓ ' : '＋ '}
                          {hhmm(start)}〜{hhmm(end)}
                        </button>
                      );
                    })
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-ink-sub">
        クリックすると、その時間から上の日時と同じ長さで候補に入ります（9:00〜18:00の空きだけ表示）。
      </p>
    </div>
  );
}
