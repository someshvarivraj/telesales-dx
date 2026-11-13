import {
  addDays,
  BOOKING_STEP_MINUTES,
  DEFAULT_APPOINTMENT_MINUTES,
  isWeekend,
  Role,
} from '@telesales/shared';
import { ChevronLeft, ChevronRight, Lock, LockOpen } from 'lucide-react';
import { useMemo } from 'react';
import { DatePicker } from '@/components/ui/DatePicker';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { TimePicker } from '@/components/ui/TimePicker';
import { usePeople } from '@/features/reference/useReference';
import { defaultEndTime, formatDate, formatRange, toInstant } from '@/lib/format';
import { useSchedule, useSlotCheck } from './api';
import { DayView } from './DayView';
import { buildEvents } from './events';
import { ScheduleLegend } from './ScheduleLegend';
import { slotProblemText } from './slotProblems';
import type { LockState } from './useSlotLock';

/** The next weekday before or after a date: Saturdays and Sundays cannot be booked (11/2). */
function nextWeekday(date: string, step: 1 | -1): string {
  let next = addDays(date, step);
  while (isWeekend(next)) next = addDays(next, step);
  return next;
}

export interface Slot {
  repId: string;
  date: string;
  start: string;
  end: string;
}

interface SlotPickerProps {
  slot: Slot;
  onChange: (slot: Slot) => void;
  lock: LockState;
  onLock: () => void;
  onUnlock: () => void;
  /** The appointment being moved does not count as an overlap. */
  appointmentId?: string;
  /** Sales booking their own appointment pick themselves. */
  repLocked?: boolean;
  /** The rep's own appointment: their テレマアポ停止 time is open to them. */
  salesBooked?: boolean;
}

/** The rep's day and the availability check for a slot (shared by the picker's parts). */
export function useSlotData(slot: Slot, appointmentId?: string, salesBooked = false) {
  const schedule = useSchedule(slot.date, slot.date, slot.repId ? [slot.repId] : []);
  const events = useMemo(() => (schedule.data ? buildEvents(schedule.data) : []), [schedule.data]);
  const people = (schedule.data?.people ?? []).filter((person) => person.id === slot.repId);
  const check = useSlotCheck(
    slot.repId && slot.start && slot.end > slot.start
      ? {
          salesRepId: slot.repId,
          startsAt: toInstant(slot.date, slot.start),
          endsAt: toInstant(slot.date, slot.end),
          kind: 'APPOINTMENT',
          appointmentId,
          salesBooked,
        }
      : null,
  );
  return { schedule: schedule.data, events, people, result: check.data };
}
export type SlotData = ReturnType<typeof useSlotData>;

/** 担当営業・日付・開始・終了. `compact`: two columns, for a narrow form beside the day. */
export function SlotInputs({
  slot,
  onChange,
  held,
  repLocked = false,
  compact = false,
}: {
  slot: Slot;
  onChange: (slot: Slot) => void;
  held: boolean;
  repLocked?: boolean;
  compact?: boolean;
}) {
  const reps = usePeople(Role.Sales);
  const set = (patch: Partial<Slot>) => onChange({ ...slot, ...patch });
  return (
    <div
      className={
        compact
          ? 'grid grid-cols-2 gap-x-3 gap-y-4'
          : 'grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_8rem_10rem]'
      }
    >
      {!(compact && repLocked) && (
        <div className={compact ? 'col-span-2' : undefined}>
          <FormField label="担当営業" required>
            {(c) => (
              <Select
                {...c}
                value={slot.repId}
                disabled={held || repLocked}
                placeholder="選択してください"
                options={(reps.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                onChange={(e) => set({ repId: e.target.value })}
              />
            )}
          </FormField>
        </div>
      )}
      <div className={compact ? 'col-span-2' : undefined}>
        <FormField label="日付" required>
          {(c) => (
            <div className="flex gap-1">
              <Button
                variant="secondary"
                aria-label="前の日"
                disabled={held}
                onClick={() => set({ date: nextWeekday(slot.date, -1) })}
                icon={<ChevronLeft className="size-4" aria-hidden="true" />}
              />
              <DatePicker
                {...c}
                className={compact ? 'min-w-0 flex-1' : undefined}
                value={slot.date}
                disabled={held}
                isDisabled={isWeekend}
                onChange={(e) => e.target.value && set({ date: e.target.value })}
              />
              <Button
                variant="secondary"
                aria-label="次の日"
                disabled={held}
                onClick={() => set({ date: nextWeekday(slot.date, 1) })}
                icon={<ChevronRight className="size-4" aria-hidden="true" />}
              />
            </div>
          )}
        </FormField>
      </div>
      <FormField label="開始" required>
        {(c) => (
          <TimePicker
            {...c}
            value={slot.start}
            disabled={held}
            fromHour={7}
            toHour={21}
            onChange={(e) => set({ start: e.target.value, end: defaultEndTime(e.target.value) })}
          />
        )}
      </FormField>
      <FormField label="終了" required>
        {(c) => (
          <TimePicker
            {...c}
            value={slot.end}
            disabled={held}
            fromHour={7}
            toHour={21}
            after={slot.start}
            durationFrom={slot.start}
            onChange={(e) => set({ end: e.target.value })}
          />
        )}
      </FormField>
    </div>
  );
}

/** The rep's day with the chosen slot; clicking free time sets the start. */
export function SlotDay({
  slot,
  onChange,
  held,
  data,
  maxHeight = '26rem',
}: {
  slot: Slot;
  onChange: (slot: Slot) => void;
  held: boolean;
  data: SlotData;
  maxHeight?: string;
}) {
  if (!slot.repId) return null;
  return (
    <>
      <ScheduleLegend />
      <DayView
        date={slot.date}
        people={data.people}
        events={data.events}
        holidays={data.schedule?.holidays ?? []}
        onEvent={() => undefined}
        onRange={held ? undefined : (_person, start, end) => onChange({ ...slot, start, end })}
        selection={{ personId: slot.repId, start: slot.start, end: slot.end }}
        maxHeight={maxHeight}
        step={BOOKING_STEP_MINUTES}
        clickMinutes={DEFAULT_APPOINTMENT_MINUTES}
        bufferMinutes={data.schedule?.travelBufferMinutes}
      />
      <p className="text-xs text-ink-sub">
        空いている時間をクリックすると30分の枠が入ります。ドラッグすると、好きな長さで選べます（30分刻み）。
      </p>
    </>
  );
}

/** Why the slot cannot be booked, and warnings. */
export function SlotProblems({ data, held }: { data: SlotData; held: boolean }) {
  const { result } = data;
  if (!result) return null;
  return (
    <>
      {!result.ok && !held && (
        <Alert tone="error">
          <p className="font-bold">この時間帯には入れられません。</p>
          <ul className="list-inside list-disc">
            {result.problems.map((problem, index) => (
              <li key={index}>{slotProblemText(problem)}</li>
            ))}
          </ul>
        </Alert>
      )}
      {result.warnings.length > 0 && (
        <Alert tone="warning">
          {result.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </Alert>
      )}
    </>
  );
}

/** Someone else holds the slot, or the hold failed or ran out. */
export function lockProblemText(lock: LockState): string | null {
  if (lock.status === 'blocked')
    return `${lock.by}さんがこの時間帯を編集中です。別の時間を選んでください。`;
  if (lock.status === 'lost') return '押さえが切れました。もう一度押さえてください。';
  if (lock.status === 'error') return '押さえられませんでした。もう一度お試しください。';
  return null;
}

/**
 * Check free/busy and hold a slot (spec §6): the rep's day, a 15-minute start, the
 * availability check, then the lock that keeps others out while the form is filled in.
 */
export function SlotPicker({
  slot,
  onChange,
  lock,
  onLock,
  onUnlock,
  appointmentId,
  repLocked = false,
  salesBooked = false,
}: SlotPickerProps) {
  const held = lock.status === 'held';
  const data = useSlotData(slot, appointmentId, salesBooked);
  const problem = lockProblemText(lock);

  return (
    <div className="flex flex-col gap-4">
      <SlotInputs slot={slot} onChange={onChange} held={held} repLocked={repLocked} />
      <SlotDay slot={slot} onChange={onChange} held={held} data={data} />
      <SlotProblems data={data} held={held} />

      <div className="flex flex-wrap items-center gap-3 rounded-(--radius-control) border border-line bg-canvas px-4 py-3">
        {held ? (
          <>
            <Lock className="size-5 text-success" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-bold">
                {formatDate(slot.date)} {slot.start}〜{slot.end} を押さえています
              </p>
              <p className="text-ink-sub">
                ほかの人はこの時間帯を編集できません。画面を開いている間は自動で延長されます。
              </p>
            </div>
            <Button
              variant="secondary"
              className="ml-auto"
              icon={<LockOpen className="size-4" aria-hidden="true" />}
              onClick={onUnlock}
            >
              枠を選び直す
            </Button>
          </>
        ) : (
          <>
            <div className="text-sm">
              {problem ? (
                <p className="font-bold text-danger">{problem}</p>
              ) : (
                <p className="text-ink-sub">
                  時間が決まったら枠を押さえてください。押さえている間、ほかの人は同じ枠に入れられません。
                </p>
              )}
            </div>
            <Button
              className="ml-auto"
              icon={<Lock className="size-4" aria-hidden="true" />}
              loading={lock.status === 'acquiring'}
              disabled={!slot.repId || !data.result?.ok}
              onClick={onLock}
            >
              この枠を押さえる
            </Button>
          </>
        )}
      </div>
      {held && lock.status === 'held' && (
        <span className="sr-only">{formatRange(lock.lock.startsAt, lock.lock.endsAt)}</span>
      )}
    </div>
  );
}
