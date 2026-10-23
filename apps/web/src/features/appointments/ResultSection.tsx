import { type AppointmentDetail, jstDate, OptionCategory } from '@telesales/shared';
import { useState } from 'react';
import { DatePicker } from '@/components/ui/DatePicker';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { TextInput } from '@/components/ui/TextInput';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { useOptionList } from '@/features/reference/useReference';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDate, formatDateTime } from '@/lib/format';
import { useAddResult } from './api';

/** Meeting result and next action (spec §2-4: entered by sales; the booker is told, N16). */
export function ResultSection({ appointment }: { appointment: AppointmentDetail }) {
  const user = useCurrentUser();
  const add = useAddResult(appointment.id);
  const responses = useOptionList(OptionCategory.MeetingResponse);
  const deals = useOptionList(OptionCategory.DealStatus);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({
    visitedOn: jstDate(new Date(appointment.startsAt)),
    attendee: user.name,
    discussion: '',
    response: '',
    dealStatus: '',
    nextAction: '',
    nextActionDate: '',
  });
  const set = <K extends keyof typeof values>(key: K, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <Card
      title="打ち合わせ結果・次回アクション"
      actions={
        appointment.abilities.addResult && !open ? (
          <Button onClick={() => setOpen(true)}>
            {appointment.results.length > 0 ? '結果を追加' : '結果を入力'}
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {open && (
          <div className="flex flex-col gap-4 rounded-(--radius-control) border border-main/40 p-4">
            {add.isError && <Alert tone="error">{errorMessageOf(add.error)}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="訪問日" required>
                {(c) => (
                  <DatePicker
                    {...c}
                    value={values.visitedOn}
                    onChange={(e) => set('visitedOn', e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="対応者">
                {(c) => (
                  <TextInput
                    {...c}
                    value={values.attendee}
                    onChange={(e) => set('attendee', e.target.value)}
                  />
                )}
              </FormField>
            </div>
            <FormField label="商談内容" required>
              {(c) => (
                <Textarea
                  {...c}
                  rows={5}
                  value={values.discussion}
                  onChange={(e) => set('discussion', e.target.value)}
                />
              )}
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="手応え">
                {(c) => (
                  <Select
                    {...c}
                    value={values.response}
                    placeholder="―"
                    options={responses.selectOptions}
                    onChange={(e) => set('response', e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="案件ステータス">
                {(c) => (
                  <Select
                    {...c}
                    value={values.dealStatus}
                    placeholder="―"
                    options={deals.selectOptions}
                    onChange={(e) => set('dealStatus', e.target.value)}
                  />
                )}
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
              <FormField label="次回アクション">
                {(c) => (
                  <TextInput
                    {...c}
                    value={values.nextAction}
                    onChange={(e) => set('nextAction', e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="予定日">
                {(c) => (
                  <DatePicker
                    {...c}
                    value={values.nextActionDate}
                    onChange={(e) => set('nextActionDate', e.target.value)}
                  />
                )}
              </FormField>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                キャンセル
              </Button>
              <Button
                loading={add.isPending}
                disabled={!values.visitedOn || !values.discussion.trim()}
                onClick={() =>
                  add.mutate(
                    { ...values, nextActionDate: values.nextActionDate || null },
                    { onSuccess: () => setOpen(false) },
                  )
                }
              >
                保存する
              </Button>
            </div>
          </div>
        )}
        {appointment.results.length === 0 && !open ? (
          <EmptyState scene="report">まだ打ち合わせ結果は入っていません。</EmptyState>
        ) : (
          <ul className="flex flex-col gap-4">
            {appointment.results.map((result) => (
              <li key={result.id} className="border-b border-line pb-4 last:border-0 last:pb-0">
                <div className="mb-2 text-xs text-ink-sub">
                  <span className="mr-3 font-bold text-ink">{result.author.name}</span>
                  {formatDateTime(result.createdAt)}
                </div>
                <DescriptionList
                  items={[
                    { label: '訪問日', value: formatDate(result.visitedOn) },
                    { label: '対応者', value: result.attendee },
                    { label: '商談内容', value: result.discussion, wide: true },
                    { label: '手応え', value: responses.labelOf(result.response) },
                    { label: '案件ステータス', value: deals.labelOf(result.dealStatus) },
                    {
                      label: '次回アクション',
                      value: result.nextAction
                        ? `${result.nextAction}${result.nextActionDate ? `（${formatDate(result.nextActionDate)}）` : ''}`
                        : null,
                      wide: true,
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
