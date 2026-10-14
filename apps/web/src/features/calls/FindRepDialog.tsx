import { OptionCategory, Role } from '@telesales/shared';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';
import { useOptionList, usePeople } from '@/features/reference/useReference';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { useFindRep } from './api';

interface FindRepDialogProps {
  open: boolean;
  onClose: () => void;
  /** New lists: the company decides the area. Existing lists: area and customer type are typed in. */
  companyId?: string;
  onChoose: (repId: string, webOnly: boolean) => void;
}

/** Decide the rep before calling (spec §7): suggested from the area table, can be changed. */
export function FindRepDialog({ open, onClose, companyId, onChoose }: FindRepDialogProps) {
  const find = useFindRep();
  const reps = usePeople(Role.Sales);
  const customerTypes = useOptionList(OptionCategory.CustomerType);
  const [area, setArea] = useState({ prefecture: '', city: '', customerType: '' });
  const [repId, setRepId] = useState('');

  const { mutate } = find;
  useEffect(() => {
    if (open && companyId) {
      mutate({ companyId }, { onSuccess: (suggestion) => setRepId(suggestion.rep?.id ?? '') });
    }
  }, [open, companyId, mutate]);

  const lookUp = () => {
    find.mutate(
      {
        prefecture: area.prefecture || undefined,
        city: area.city || undefined,
        customerType: area.customerType || undefined,
      },
      { onSuccess: (suggestion) => setRepId(suggestion.rep?.id ?? '') },
    );
  };

  const suggestion = find.data;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="担当営業を判定"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button disabled={!repId} onClick={() => onChoose(repId, suggestion?.webOnly ?? false)}>
            この営業の予定を開く
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!companyId && (
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="都道府県">
              {(c) => (
                <TextInput
                  {...c}
                  value={area.prefecture}
                  placeholder="大阪府"
                  onChange={(e) => setArea({ ...area, prefecture: e.target.value })}
                />
              )}
            </FormField>
            <FormField label="市区町村">
              {(c) => (
                <TextInput
                  {...c}
                  value={area.city}
                  placeholder="大阪市"
                  onChange={(e) => setArea({ ...area, city: e.target.value })}
                />
              )}
            </FormField>
            <FormField label="取引区分">
              {(c) => (
                <Select
                  {...c}
                  value={area.customerType}
                  placeholder="―"
                  options={customerTypes.selectOptions}
                  onChange={(e) => setArea({ ...area, customerType: e.target.value })}
                />
              )}
            </FormField>
            <div className="sm:col-span-3">
              <Button variant="secondary" onClick={lookUp} loading={find.isPending}>
                営業担当表から探す
              </Button>
            </div>
          </div>
        )}
        {find.isError && <Alert tone="error">{errorMessageOf(find.error)}</Alert>}
        {suggestion && (
          <Alert tone={suggestion.rep ? 'info' : 'warning'}>
            {suggestion.rep ? (
              <span className="flex flex-wrap items-center gap-2">
                営業担当表では <b>{suggestion.rep.name}</b> さんです（{suggestion.matchedBy}）。
                {suggestion.backup && <span>代わりの人：{suggestion.backup.name}</span>}
                {suggestion.webOnly && <Badge tone="main">Webのみのエリア</Badge>}
              </span>
            ) : (
              '営業担当表に合う行がありません。担当営業を選んでください。'
            )}
          </Alert>
        )}
        <FormField label="担当営業" required>
          {(c) => (
            <Select
              {...c}
              value={repId}
              placeholder="選択してください"
              options={(reps.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
              onChange={(e) => setRepId(e.target.value)}
            />
          )}
        </FormField>
      </div>
    </Dialog>
  );
}
