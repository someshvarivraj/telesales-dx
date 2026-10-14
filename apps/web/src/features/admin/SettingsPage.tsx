import type { AppSettingsDto } from '@telesales/shared';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormField } from '@/components/ui/FormField';
import { QueryState } from '@/components/ui/QueryState';
import { TextInput } from '@/components/ui/TextInput';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { useAdminSettings, useSaveSettings } from './api';

/** Travel time around plans (spec §7: value and warn/block decided by sales). */
export function SettingsPage() {
  const query = useAdminSettings();
  return <QueryState query={query}>{(settings) => <SettingsForm initial={settings} />}</QueryState>;
}

function SettingsForm({ initial }: { initial: AppSettingsDto }) {
  const save = useSaveSettings();
  const [values, setValues] = useState(initial);
  return (
    <Card title="移動時間">
      <div className="flex max-w-xl flex-col gap-4">
        {save.isError && <Alert tone="error">{errorMessageOf(save.error)}</Alert>}
        {save.isSuccess && <Alert tone="success">保存しました。</Alert>}
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
        <div>
          <Button loading={save.isPending} onClick={() => save.mutate(values)}>
            保存する
          </Button>
        </div>
      </div>
    </Card>
  );
}
