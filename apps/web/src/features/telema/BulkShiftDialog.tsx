import { dayOfWeek, ShiftKind, type ShiftDto, type TelemarketerDto } from '@telesales/shared';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';
import { TimePicker } from '@/components/ui/TimePicker';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { todayJst } from '@/lib/format';
import { useSaveShifts } from './api';
import { formatMinutes } from './telemaAccess';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const BREAKS = [0, 15, 30, 45, 60, 75, 90, 120].map((minutes) => ({
  value: String(minutes),
  label: `${minutes}分`,
}));

const toMinutes = (time: string) => {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return h * 60 + m;
};

interface Props {
  onClose: () => void;
  month: string;
  days: { date: string; businessDay: boolean; holidayName: string | null }[];
  /** People this user may enter for: only themselves, or everyone for leads and admins. */
  people: TelemarketerDto[];
  initialPersonId: string;
  shifts: ShiftDto[];
  canEdit: (ownerId: string, date: string) => boolean;
}

/**
 * Several days in one go (request 11/13): pick any days on the month — next to each other or
 * not — and give them the same hours, or mark them off.
 */
export function BulkShiftDialog({
  onClose,
  month,
  days,
  people,
  initialPersonId,
  shifts,
  canEdit,
}: Props) {
  const save = useSaveShifts();
  const [personId, setPersonId] = useState(initialPersonId);
  const person = people.find((entry) => entry.user.id === personId) ?? people[0];
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<string>(ShiftKind.Work);
  const [start, setStart] = useState(person?.usualStart ?? '09:00');
  const [end, setEnd] = useState(person?.usualEnd ?? '18:00');
  const [breakMinutes, setBreakMinutes] = useState(person?.usualBreakMinutes ?? 60);
  const [note, setNote] = useState('');
  const today = todayJst();
  if (!person) return null;

  const work = kind === ShiftKind.Work;
  const invalid = work && end <= start;
  const entered = new Map(
    shifts.filter((shift) => shift.userId === person.user.id).map((shift) => [shift.date, shift]),
  );
  const editable = (date: string) => canEdit(person.user.id, date);
  const toggle = (date: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  const pickWhere = (test: (day: (typeof days)[number]) => boolean) =>
    setPicked(new Set(days.filter((day) => editable(day.date) && test(day)).map((d) => d.date)));
  const choosePerson = (id: string) => {
    const next = people.find((entry) => entry.user.id === id);
    setPersonId(id);
    setPicked(new Set());
    if (next?.usualStart) setStart(next.usualStart);
    if (next?.usualEnd) setEnd(next.usualEnd);
    if (next) setBreakMinutes(next.usualBreakMinutes);
  };

  const first = days[0]?.date;
  const leading = first ? dayOfWeek(first) : 0;
  const working = Math.max(0, toMinutes(end) - toMinutes(start) - breakMinutes);

  const submit = () =>
    save.mutate(
      [...picked].sort().map((date) => ({
        userId: person.user.id,
        date,
        kind: kind as ShiftKind,
        startTime: work ? start : null,
        endTime: work ? end : null,
        breakMinutes: work ? breakMinutes : 0,
        note: note.trim() || null,
      })),
      { onSuccess: onClose },
    );

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={`シフトをまとめて入力　${month.replace('-', '年')}月`}
      footer={
        <>
          <span className="mr-auto text-sm text-ink-sub">
            {picked.size > 0 ? `${picked.size}日を選んでいます` : '日付を選んでください'}
          </span>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button loading={save.isPending} disabled={picked.size === 0 || invalid} onClick={submit}>
            {picked.size > 0 ? `${picked.size}日分を保存` : '保存する'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {save.error && <Alert tone="error">{errorMessageOf(save.error)}</Alert>}

        {people.length > 1 && (
          <FormField label="だれのシフト">
            {(c) => (
              <Select
                {...c}
                value={person.user.id}
                options={people.map((entry) => ({ value: entry.user.id, label: entry.user.name }))}
                onChange={(e) => choosePerson(e.target.value)}
              />
            )}
          </FormField>
        )}

        <section aria-label="日付を選ぶ">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">日付を選ぶ</span>
            <span className="text-xs text-ink-sub">押した日が選ばれます（離れた日も選べます）</span>
            <div className="ml-auto flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="text"
                onClick={() =>
                  pickWhere(
                    (day) => day.businessDay && person.usualWeekdays.includes(dayOfWeek(day.date)),
                  )
                }
              >
                いつもの曜日
              </Button>
              <Button size="sm" variant="text" onClick={() => pickWhere((day) => day.businessDay)}>
                営業日すべて
              </Button>
              <Button size="sm" variant="text" onClick={() => setPicked(new Set())}>
                選択を外す
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {WEEKDAYS.map((label, index) => (
              <span
                key={label}
                className={cn(
                  'py-1 font-bold',
                  index === 0 && 'text-sunday',
                  index === 6 && 'text-saturday',
                )}
              >
                {label}
              </span>
            ))}
            {Array.from({ length: leading }, (_, index) => (
              <span key={`blank-${index}`} />
            ))}
            {days.map((day) => {
              const on = picked.has(day.date);
              const can = editable(day.date);
              const shift = entered.get(day.date);
              const past = day.date < today;
              return (
                <button
                  key={day.date}
                  type="button"
                  disabled={!can}
                  aria-pressed={on}
                  aria-label={`${day.date}${on ? ' 選択中' : ''}`}
                  title={day.holidayName ?? undefined}
                  onClick={() => toggle(day.date)}
                  className={cn(
                    'relative flex h-14 flex-col items-center justify-center gap-0.5 border tabular-nums transition-colors',
                    on
                      ? 'border-main bg-main text-white shadow-[0_1px_2px_rgb(194_65_12/0.25)]'
                      : can
                        ? 'border-line-strong bg-surface hover:border-main hover:bg-main-soft'
                        : 'cursor-not-allowed border-line bg-column text-ink-disabled',
                    !on && !day.businessDay && can && 'bg-off',
                    day.date === today && !on && 'border-2 border-main',
                    past && !on && can && 'bg-column text-ink-sub',
                  )}
                >
                  <span className={cn('text-sm font-bold', past && !on && 'font-normal')}>
                    {Number(day.date.slice(8))}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] leading-none',
                      on ? 'text-white/90' : 'text-ink-sub',
                    )}
                  >
                    {day.date === today
                      ? '今日'
                      : shift
                        ? shift.kind === ShiftKind.Off
                          ? '休'
                          : shift.startTime
                        : (day.holidayName ?? '')}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <fieldset className="flex gap-6">
          <legend className="mb-1 text-sm font-bold">区分</legend>
          <Checkbox
            type="radio"
            name="bulk-kind"
            label="出勤"
            checked={work}
            onChange={() => setKind(ShiftKind.Work)}
          />
          <Checkbox
            type="radio"
            name="bulk-kind"
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
              1日の稼働時間：{formatMinutes(working)}
              {picked.size > 0 && `　合計：${formatMinutes(working * picked.size)}`}
            </p>
          </>
        )}
        <FormField label="メモ" hint="選んだ日すべてに入ります">
          {(c) => (
            <TextInput
              {...c}
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </FormField>
        <p className="text-xs text-ink-sub">入力済みの日を選ぶと、この内容で上書きします。</p>
      </div>
    </Dialog>
  );
}
