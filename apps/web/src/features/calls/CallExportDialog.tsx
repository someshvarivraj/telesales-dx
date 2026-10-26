import { Role } from '@telesales/shared';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { usePeople } from '@/features/reference/useReference';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { addDays } from '@telesales/shared';
import { todayJst } from '@/lib/format';
import { downloadCallResults, useListNames } from './api';

/**
 * 架電結果をExcelで出す (Sano 10/24 No.7): calls in a period, optionally for one
 * telemarketer or one list, one row per call with the company.
 */
export function CallExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const today = todayJst();
  const [values, setValues] = useState({
    from: addDays(today, -6),
    to: today,
    telemarketerId: '',
    listName: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const telemarketers = usePeople(Role.Telema);
  const listNames = useListNames();

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadCallResults(values);
      onClose();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="架電結果をExcelで出す"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            icon={<Download className="size-4" aria-hidden="true" />}
            loading={busy}
            disabled={!values.from || !values.to || values.to < values.from}
            onClick={() => void download()}
          >
            ダウンロード
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {Boolean(error) && <Alert tone="error">{errorMessageOf(error)}</Alert>}
        <p className="text-sm text-ink-sub">
          期間中の架電を1件1行で出します（判定・結果の詳細・次回架電日と、架けた企業の情報）。
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="架電日（から）" required>
            {(c) => (
              <DatePicker
                {...c}
                value={values.from}
                onChange={(e) => setValues({ ...values, from: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="架電日（まで）" required>
            {(c) => (
              <DatePicker
                {...c}
                value={values.to}
                min={values.from}
                onChange={(e) => setValues({ ...values, to: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="テレマ担当">
            {(c) => (
              <Select
                {...c}
                value={values.telemarketerId}
                placeholder="全員"
                options={(telemarketers.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                onChange={(e) => setValues({ ...values, telemarketerId: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="リスト名">
            {(c) => (
              <Select
                {...c}
                value={values.listName}
                placeholder="すべて"
                options={(listNames.data ?? []).map((name) => ({ value: name, label: name }))}
                onChange={(e) => setValues({ ...values, listName: e.target.value })}
              />
            )}
          </FormField>
        </div>
      </div>
    </Dialog>
  );
}
