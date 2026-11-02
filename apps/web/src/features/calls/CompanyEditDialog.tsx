import { type CompanyDetail, formatCapital, OptionCategory, parseCapital } from '@telesales/shared';
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
  ['sourceUrl', '掲載元のURL'],
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
  const [walk, setWalk] = useState(company.walkMinutes === null ? '' : String(company.walkMinutes));
  // 資本金 can be typed as 「1億2000万」 or 「120000000」; it is shown back in 億・万 (11/2).
  const [capitalText, setCapitalText] = useState(
    company.capital === null ? '' : String(company.capital),
  );
  const capital = parseCapital(capitalText);
  const capitalInvalid = capitalText.trim() !== '' && capital === null;
  const walkMinutes = walk.trim() === '' ? null : Number(walk.normalize('NFKC'));
  const walkInvalid =
    walkMinutes !== null &&
    (!Number.isInteger(walkMinutes) || walkMinutes < 0 || walkMinutes > 240);

  const save = () =>
    update.mutate(
      {
        ...values,
        walkMinutes: walkInvalid ? company.walkMinutes : walkMinutes,
        capital,
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
          <Button
            onClick={save}
            loading={update.isPending}
            disabled={!values.name.trim() || capitalInvalid || walkInvalid}
          >
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
        <FormField
          label="駅から徒歩（分）"
          error={walkInvalid ? '0〜240の数字で入力してください' : undefined}
        >
          {(c) => (
            <TextInput
              {...c}
              inputMode="numeric"
              value={walk}
              placeholder="例：5"
              onChange={(e) => setWalk(e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="資本金"
          hint={
            capital !== null
              ? `＝ ${formatCapital(capital)}`
              : '「1億2000万」でも「120000000」でも入力できます。'
          }
          error={capitalInvalid ? '金額として読めません（例：1億2000万）' : undefined}
        >
          {(c) => (
            <TextInput
              {...c}
              value={capitalText}
              placeholder="例：1億2000万"
              onChange={(e) => setCapitalText(e.target.value)}
            />
          )}
        </FormField>
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
