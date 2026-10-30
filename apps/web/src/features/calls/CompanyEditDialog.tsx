import { type CompanyDetail, OptionCategory } from '@telesales/shared';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';
import { useOptionList } from '@/features/reference/useReference';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { useUpdateCompany } from './api';

const FIELDS = [
  ['name', '会社名'],
  ['office', '事業所'],
  ['department', '部署'],
  ['phone', '電話番号'],
  ['url', 'URL'],
  ['address', '住所'],
  ['prefecture', '都道府県'],
  ['city', '市区町村'],
  ['nearestStation', '最寄駅'],
  ['industry', '業種'],
  ['clientNo', 'クライアントNo'],
  ['parentName', '親会社名'],
] as const;

type Key = (typeof FIELDS)[number][0] | 'customerType' | 'companyRank';

export function CompanyEditDialog({
  company,
  open,
  onClose,
}: {
  company: CompanyDetail;
  open: boolean;
  onClose: () => void;
}) {
  const update = useUpdateCompany(company.id);
  const customerTypes = useOptionList(OptionCategory.CustomerType);
  const ranks = useOptionList(OptionCategory.CompanyRank);
  const [values, setValues] = useState<Record<Key, string>>(() => {
    const initial = {} as Record<Key, string>;
    for (const [key] of FIELDS) initial[key] = company[key] ?? '';
    initial.customerType = company.customerType ?? '';
    initial.companyRank = company.companyRank ?? '';
    return initial;
  });
  const set = (key: Key, value: string) => setValues((current) => ({ ...current, [key]: value }));

  const save = () =>
    update.mutate(
      {
        ...values,
        listingStatus: company.listingStatus,
        companyGroupId: company.companyGroupId,
        expectedUpdatedAt: company.updatedAt,
      },
      { onSuccess: onClose },
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="企業情報の編集"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={save} loading={update.isPending} disabled={!values.name.trim()}>
            保存する
          </Button>
        </>
      }
    >
      {update.isError && (
        <Alert tone="error" className="mb-4">
          {errorMessageOf(update.error)}
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(([key, label]) => (
          <FormField
            key={key}
            label={label}
            required={key === 'name'}
            hint={key === 'name' ? '社名を変えると、前の名前は旧社名として残ります。' : undefined}
          >
            {(c) => (
              <TextInput {...c} value={values[key]} onChange={(e) => set(key, e.target.value)} />
            )}
          </FormField>
        ))}
        <FormField label="企業ランク">
          {(c) => (
            <Select
              {...c}
              value={values.companyRank}
              placeholder="―"
              options={[
                ...ranks.selectOptions,
                // A rank imported as written (not one of the choices) stays selectable.
                ...(values.companyRank && !ranks.items.some((r) => r.code === values.companyRank)
                  ? [{ value: values.companyRank, label: values.companyRank }]
                  : []),
              ]}
              onChange={(e) => set('companyRank', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="取引区分">
          {(c) => (
            <Select
              {...c}
              value={values.customerType}
              placeholder="―"
              options={customerTypes.selectOptions}
              onChange={(e) => set('customerType', e.target.value)}
            />
          )}
        </FormField>
      </div>
    </Dialog>
  );
}
