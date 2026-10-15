import { addDays, Role } from '@telesales/shared';
import { ChevronLeft, ChevronRight, Lock, LockOpen } from 'lucide-react';
import { useMemo } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';
import { usePeople } from '@/features/reference/useReference';
import { defaultEndTime, formatDate, formatRange, timeOptions, toInstant } from '@/lib/format';
import { useSchedule, useSlotCheck } from './api';
import { DayView } from './DayView';
import { buildEvents } from './events';
import { ScheduleLegend } from './ScheduleLegend';
import { slotProblemText } from './slotProblems';
import type { LockState } from './useSlotLock';

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
}

const TIMES = timeOptions(7, 21).map((time) => ({ value: time, label: time }));

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
}: SlotPickerProps) {
  const reps = usePeople(Role.Sales);
  const held = lock.status === 'held';
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
        }
      : null,
  );
  const result = check.data;
  const set = (patch: Partial<Slot>) => onChange({ ...slot, ...patch });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_8rem_8rem]">
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
        <FormField label="日付" required>
          {(c) => (
            <div className="flex gap-1">
              <Button
                variant="secondary"
                aria-label="前の日"
                disabled={held}
                onClick={() => set({ date: addDays(slot.date, -1) })}
                icon={<ChevronLeft className="size-4" aria-hidden="true" />}
              />
              <TextInput
                {...c}
                type="date"
                value={slot.date}
                disabled={held}
                onChange={(e) => e.target.value && set({ date: e.target.value })}
              />
              <Button
                variant="secondary"
                aria-label="次の日"
                disabled={held}
                onClick={() => set({ date: addDays(slot.date, 1) })}
                icon={<ChevronRight className="size-4" aria-hidden="true" />}
              />
            </div>
          )}
        </FormField>
        <FormField label="開始" required>
          {(c) => (
            <Select
              {...c}
              value={slot.start}
              disabled={held}
              options={TIMES}
              onChange={(e) => set({ start: e.target.value, end: defaultEndTime(e.target.value) })}
            />
          )}
        </FormField>
        <FormField label="終了" required>
          {(c) => (
            <Select
              {...c}
              value={slot.end}
              disabled={held}
              options={TIMES.filter((t) => t.value > slot.start)}
              onChange={(e) => set({ end: e.target.value })}
            />
          )}
        </FormField>
      </div>

      {slot.repId && (
        <>
          <ScheduleLegend />
          <DayView
            date={slot.date}
            people={people}
            events={events}
            holidays={schedule.data?.holidays ?? []}
            onEvent={() => undefined}
            onSlot={
              held ? undefined : (_person, time) => set({ start: time, end: defaultEndTime(time) })
            }
            selection={{ personId: slot.repId, start: slot.start, end: slot.end }}
          />
          <p className="text-xs text-ink-sub">
            空いている時間をクリックすると開始時刻が入ります（15分刻み・初期値は60分）。
          </p>
        </>
      )}

      {result && !result.ok && !held && (
        <Alert tone="error">
          <p className="font-bold">この時間帯には入れられません。</p>
          <ul className="list-inside list-disc">
            {result.problems.map((problem, index) => (
              <li key={index}>{slotProblemText(problem)}</li>
            ))}
          </ul>
        </Alert>
      )}
      {result && result.warnings.length > 0 && (
        <Alert tone="warning">
          {result.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </Alert>
      )}

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
              {lock.status === 'blocked' && (
                <p className="font-bold text-danger">
                  {lock.by}さんがこの時間帯を編集中です。別の時間を選んでください。
                </p>
              )}
              {lock.status === 'lost' && (
                <p className="font-bold text-danger">
                  押さえが切れました。もう一度押さえてください。
                </p>
              )}
              {lock.status === 'error' && (
                <p className="font-bold text-danger">
                  押さえられませんでした。もう一度お試しください。
                </p>
              )}
              {(lock.status === 'idle' || lock.status === 'acquiring') && (
                <p className="text-ink-sub">
                  時間が決まったら枠を押さえてください。押さえている間、ほかの人は同じ枠に入れられません。
                </p>
              )}
            </div>
            <Button
              className="ml-auto"
              icon={<Lock className="size-4" aria-hidden="true" />}
              loading={lock.status === 'acquiring'}
              disabled={!slot.repId || !result?.ok}
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
