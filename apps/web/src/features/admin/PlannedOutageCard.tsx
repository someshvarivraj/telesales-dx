import { addDays } from '@telesales/shared';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DatePicker } from '@/components/ui/DatePicker';
import { DraftNotice, ResetButton } from '@/components/ui/DraftBar';
import { FormField } from '@/components/ui/FormField';
import { TextInput } from '@/components/ui/TextInput';
import { TimePicker } from '@/components/ui/TimePicker';
import { useSystemStatus } from '@/features/system/useSystemStatus';
import { PlannedOutageBanner } from '@/features/system/PlannedOutageBanner';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { useDraft } from '@/lib/drafts';
import { todayJst, toInstant } from '@/lib/format';
import { useRemovePlannedOutage, useSavePlannedOutage } from './api';

/**
 * 「メンテナンスのお知らせ」 (request 11/4): when the server will be down (AWS work and so on),
 * post the period here and everyone sees it on every screen and on the login screen.
 */
export function PlannedOutageCard() {
  const status = useSystemStatus();
  const save = useSavePlannedOutage();
  const remove = useRemovePlannedOutage();
  const today = todayJst();
  const draft = useDraft('planned-outage', {
    date: today,
    start: '11:00',
    endDate: today,
    end: '14:00',
    note: '',
  });
  const values = draft.value;
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    draft.set((current) => ({ ...current, [key]: value }));
  const startsAt = toInstant(values.date, values.start);
  const endsAt = toInstant(values.endDate, values.end);
  const invalid = new Date(endsAt) <= new Date(startsAt);
  const posted = status.data?.plannedOutage ?? null;
  const error = save.error ?? remove.error;

  return (
    <Card title="メンテナンスのお知らせ">
      <div className="flex max-w-3xl flex-col gap-4">
        <p className="text-sm text-ink-sub">
          サーバーが止まる予定を入れると、全員の画面とログイン画面に、保存した時から終わるまで表示します。30分前からは閉じられなくなります。
        </p>
        <DraftNotice restoredAt={draft.restoredAt} onReset={draft.reset} />
        {error && <Alert tone="error">{errorMessageOf(error)}</Alert>}
        {posted && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold text-ink-sub">いま表示しているお知らせ</p>
            <PlannedOutageBanner outage={posted} />
            <div>
              <Button
                size="sm"
                variant="secondary"
                loading={remove.isPending}
                onClick={() => remove.mutate()}
              >
                お知らせを取り下げる
              </Button>
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="開始日" required>
            {(c) => (
              <DatePicker
                {...c}
                value={values.date}
                onChange={(e) =>
                  draft.set((current) => ({
                    ...current,
                    date: e.target.value,
                    endDate: e.target.value,
                  }))
                }
              />
            )}
          </FormField>
          <FormField label="開始時刻" required>
            {(c) => (
              <TimePicker
                {...c}
                value={values.start}
                fromHour={0}
                toHour={23}
                onChange={(e) => set('start', e.target.value)}
              />
            )}
          </FormField>
          <FormField label="終了日" required>
            {(c) => (
              <DatePicker
                {...c}
                value={values.endDate}
                min={values.date}
                max={addDays(values.date, 14)}
                onChange={(e) => set('endDate', e.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="終了時刻"
            required
            error={invalid ? '開始より後にしてください' : undefined}
          >
            {(c) => (
              <TimePicker
                {...c}
                value={values.end}
                fromHour={0}
                toHour={23}
                onChange={(e) => set('end', e.target.value)}
              />
            )}
          </FormField>
        </div>
        <FormField label="ひとこと" hint="例：AWS のメンテナンスのため">
          {(c) => (
            <TextInput
              {...c}
              value={values.note}
              maxLength={200}
              onChange={(e) => set('note', e.target.value)}
            />
          )}
        </FormField>
        <div className="flex items-center justify-between gap-2">
          <ResetButton dirty={draft.dirty} onReset={draft.reset} />
          <Button
            disabled={invalid}
            loading={save.isPending}
            onClick={() =>
              save.mutate(
                { startsAt, endsAt, note: values.note },
                { onSuccess: () => draft.reset() },
              )
            }
          >
            {posted ? 'お知らせを更新する' : 'お知らせを出す'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
