import type { AppSettingsDto } from '@telesales/shared';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormField } from '@/components/ui/FormField';
import { QueryState } from '@/components/ui/QueryState';
import { Select } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { timeOptions } from '@/lib/format';
import { useAdminSettings, useSaveSettings } from './api';

const RUN_TIMES = timeOptions(6, 12).map((time) => ({ value: time, label: time }));
const REMINDER_MINUTES = [30, 60, 120, 180, 240, 480].map((minutes) => ({
  value: String(minutes),
  label: minutes < 60 ? `${minutes}分` : `${minutes / 60}時間`,
}));

/**
 * Small settings kept as data: travel time around plans (spec §7, decided by sales),
 * the morning allocation run, and the untaken change request reminder (N13).
 */
export function SettingsPage() {
  const query = useAdminSettings();
  return <QueryState query={query}>{(settings) => <SettingsForm initial={settings} />}</QueryState>;
}

function SettingsForm({ initial }: { initial: AppSettingsDto }) {
  const save = useSaveSettings();
  const [values, setValues] = useState(initial);
  return (
    <div className="flex flex-col gap-5">
      {save.isError && <Alert tone="error">{errorMessageOf(save.error)}</Alert>}
      {save.isSuccess && <Alert tone="success">保存しました。</Alert>}
      <Card title="移動時間">
        <div className="flex max-w-xl flex-col gap-4">
          <FormField label="予定の前後に空ける時間（分）" hint="0 のときは確かめません。">
            {(c) => (
              <TextInput
                {...c}
                type="number"
                min={0}
                max={240}
                step={15}
                value={values.travelBufferMinutes}
                onChange={(e) =>
                  setValues({ ...values, travelBufferMinutes: Number(e.target.value) })
                }
              />
            )}
          </FormField>
          <fieldset>
            <legend className="mb-1 text-sm font-bold">足りないとき</legend>
            <div className="flex gap-6">
              <Checkbox
                type="radio"
                name="mode"
                label="注意を出すだけ"
                checked={values.travelBufferMode === 'WARN'}
                onChange={() => setValues({ ...values, travelBufferMode: 'WARN' })}
              />
              <Checkbox
                type="radio"
                name="mode"
                label="アポを入れられなくする"
                checked={values.travelBufferMode === 'BLOCK'}
                onChange={() => setValues({ ...values, travelBufferMode: 'BLOCK' })}
              />
            </div>
          </fieldset>
        </div>
      </Card>
      <Card title="テレマの割り振り・変更依頼">
        <div className="flex max-w-xl flex-col gap-4">
          <FormField
            label="朝の自動割り振りの時刻"
            hint="営業日のこの時刻に、その日の割り振りの案を作ります。確定はリーダーが行います。"
          >
            {(c) => (
              <Select
                {...c}
                value={values.allocationRunTime}
                options={RUN_TIMES}
                onChange={(e) => setValues({ ...values, allocationRunTime: e.target.value })}
              />
            )}
          </FormField>
          <FormField
            label="変更依頼が未対応のときに知らせるまでの時間（N13）"
            hint="通知の宛先で N13 をオンにしたときだけ使います（初期はオフ）。"
          >
            {(c) => (
              <Select
                {...c}
                value={String(values.changeRequestReminderMinutes)}
                options={REMINDER_MINUTES}
                onChange={(e) =>
                  setValues({ ...values, changeRequestReminderMinutes: Number(e.target.value) })
                }
              />
            )}
          </FormField>
        </div>
      </Card>
      <div>
        <Button loading={save.isPending} onClick={() => save.mutate(values)}>
          保存する
        </Button>
      </div>
    </div>
  );
}
