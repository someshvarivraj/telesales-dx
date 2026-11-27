import { addDays, jstDate, type PlanDto, Role } from '@telesales/shared';
import { CalendarClock, Pencil, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DatePicker } from '@/components/ui/DatePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { QueryState } from '@/components/ui/QueryState';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { TextInput } from '@/components/ui/TextInput';
import { TimePicker } from '@/components/ui/TimePicker';
import { usePeople } from '@/features/reference/useReference';
import { AttendeePicker } from '@/features/schedule/AttendeePicker';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDate, formatRange, formatTime, todayJst, toInstant } from '@/lib/format';
import { useDeleteMeeting, useMeetings, useSaveMeeting } from './api';

interface Draft {
  id?: string;
  title: string;
  date: string;
  allDay: boolean;
  start: string;
  end: string;
  note: string;
  /** null: every sales rep (the default). */
  salesIds: string[] | null;
}

const blank = (): Draft => ({
  title: '',
  date: todayJst(),
  allDay: false,
  start: '10:00',
  end: '11:00',
  note: '',
  salesIds: null,
});

/**
 * 社内の予定 (request 11/27): telemarketing puts one company meeting on the sales reps'
 * calendars at once. Everyone is chosen to start with; click a rep to leave them out.
 */
export function MeetingsPage() {
  const meetings = useMeetings();
  const sales = usePeople(Role.Sales);
  const save = useSaveMeeting();
  const remove = useDeleteMeeting();
  const allSales = (sales.data ?? []).map((person) => person.id);
  const [draft, setDraft] = useState<Draft>(blank);
  const [tried, setTried] = useState(false);
  const salesIds = draft.salesIds ?? allSales;
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const timeOk = draft.allDay || draft.end > draft.start;
  const missing = !draft.title.trim() || salesIds.length === 0 || !timeOk;

  const submit = () => {
    setTried(true);
    if (missing) return;
    save.mutate(
      {
        id: draft.id,
        request: {
          title: draft.title.trim(),
          startsAt: toInstant(draft.date, draft.allDay ? '00:00' : draft.start),
          endsAt: draft.allDay
            ? toInstant(addDays(draft.date, 1), '00:00')
            : toInstant(draft.date, draft.end),
          allDay: draft.allDay,
          note: draft.note.trim() || null,
          salesIds,
        },
      },
      {
        onSuccess: () => {
          setDraft(blank());
          setTried(false);
        },
      },
    );
  };

  const edit = (meeting: PlanDto) => {
    const date = new Date(meeting.startsAt);
    setDraft({
      id: meeting.id,
      title: meeting.title,
      date: jstDate(date),
      allDay: meeting.allDay,
      start: meeting.allDay ? '10:00' : formatTime(meeting.startsAt),
      end: meeting.allDay ? '11:00' : formatTime(meeting.endsAt),
      note: meeting.note ?? '',
      salesIds: meeting.attendees.map((person) => person.id),
    });
    setTried(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card title={draft.id ? '社内の予定を変更' : '社内の予定を入れる'}>
        <div className="flex flex-col gap-5">
          <p className="text-sm text-ink-sub">
            営業会議など、営業さん全員（または選んだ人）の予定にまとめて入ります。
          </p>
          {save.isError && <Alert tone="error">{errorMessageOf(save.error)}</Alert>}
          <FormField
            label="件名"
            required
            error={tried && !draft.title.trim() ? '件名を入れてください。' : undefined}
          >
            {(field) => (
              <TextInput
                {...field}
                value={draft.title}
                maxLength={200}
                placeholder="例：営業会議"
                onChange={(event) => set({ title: event.target.value })}
              />
            )}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="日付" required>
                {(field) => (
                  <DatePicker
                    {...field}
                    value={draft.date}
                    onChange={(event) => event.target.value && set({ date: event.target.value })}
                  />
                )}
              </FormField>
            </div>
            {!draft.allDay && (
              <>
                <FormField label="開始" required>
                  {(field) => (
                    <TimePicker
                      {...field}
                      value={draft.start}
                      fromHour={7}
                      toHour={21}
                      onChange={(event) => set({ start: event.target.value })}
                    />
                  )}
                </FormField>
                <FormField
                  label="終了"
                  required
                  error={tried && !timeOk ? '開始より後にしてください。' : undefined}
                >
                  {(field) => (
                    <TimePicker
                      {...field}
                      value={draft.end}
                      fromHour={7}
                      toHour={21}
                      after={draft.start}
                      durationFrom={draft.start}
                      onChange={(event) => set({ end: event.target.value })}
                    />
                  )}
                </FormField>
              </>
            )}
          </div>
          <Switch label="終日" checked={draft.allDay} onChange={(allDay) => set({ allDay })} />
          <div className="flex flex-col gap-2">
            <p className="flex items-baseline gap-2 text-[13px] font-bold">
              参加する営業
              <span className="text-xs font-normal text-ink-sub tabular-nums">
                {salesIds.length}／{allSales.length}人・押すと外れます
              </span>
            </p>
            <AttendeePicker
              ownerId=""
              value={salesIds}
              onChange={(salesIds) => set({ salesIds })}
              tall
            />
            {tried && salesIds.length === 0 && (
              <p className="text-sm text-danger">参加する営業を選んでください。</p>
            )}
          </div>
          <FormField label="メモ">
            {(field) => (
              <Textarea
                {...field}
                rows={3}
                maxLength={2000}
                value={draft.note}
                placeholder="例：本社 3F 会議室／資料は前日までに共有"
                onChange={(event) => set({ note: event.target.value })}
              />
            )}
          </FormField>
          <div className="flex justify-end gap-2">
            {draft.id && (
              <Button variant="secondary" onClick={() => setDraft(blank())}>
                やめる
              </Button>
            )}
            <Button onClick={submit} loading={save.isPending}>
              {draft.id ? '変更を保存' : '予定を入れる'}
            </Button>
          </div>
        </div>
      </Card>

      <Card title="これからの社内の予定" flush>
        {remove.isError && (
          <Alert tone="error" className="m-4">
            {errorMessageOf(remove.error)}
          </Alert>
        )}
        <QueryState query={meetings}>
          {(items) =>
            items.length === 0 ? (
              <EmptyState scene="schedule">これからの社内の予定はありません。</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((meeting) => {
                  const everyone =
                    allSales.length > 0 &&
                    allSales.every((id) => meeting.attendees.some((a) => a.id === id));
                  return (
                    <li key={meeting.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{meeting.title}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-sub">
                          <CalendarClock aria-hidden="true" className="size-4" />
                          {meeting.allDay
                            ? `${formatDate(jstDate(new Date(meeting.startsAt)))}（終日）`
                            : formatRange(meeting.startsAt, meeting.endsAt)}
                        </p>
                        <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-sub">
                          <Users aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                          {everyone
                            ? `営業全員（${meeting.attendees.length}人）`
                            : `${meeting.attendees.map((a) => a.name).join('、')}（${meeting.attendees.length}人）`}
                        </p>
                        {meeting.note && (
                          <p className="mt-1 text-sm whitespace-pre-wrap">{meeting.note}</p>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          variant="secondary"
                          icon={<Pencil className="size-4" aria-hidden="true" />}
                          onClick={() => edit(meeting)}
                        >
                          変更
                        </Button>
                        <Button
                          variant="text"
                          icon={<Trash2 className="size-4" aria-hidden="true" />}
                          loading={remove.isPending && remove.variables === meeting.id}
                          onClick={() => {
                            if (
                              window.confirm(
                                `「${meeting.title}」を削除しますか？参加する営業さんの予定からも消えます。`,
                              )
                            )
                              remove.mutate(meeting.id);
                          }}
                        >
                          削除
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          }
        </QueryState>
      </Card>
    </div>
  );
}
