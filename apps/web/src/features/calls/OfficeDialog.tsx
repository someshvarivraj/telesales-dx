import {
  type CompanyDetail,
  type CreateOfficeConflict,
  PHONE_DIGITS_PATTERN,
  phoneDigitsOf,
} from '@telesales/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Button, LinkButton } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { TextInput } from '@/components/ui/TextInput';
import { ApiError } from '@/lib/api/ApiError';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { useCreateOffice } from './api';

interface OfficeDialogProps {
  company: CompanyDetail;
  open: boolean;
  onClose: () => void;
  onCreated: (created: CompanyDetail) => void;
}

const FIELDS = [
  { key: 'name', label: '会社名', required: true },
  { key: 'office', label: '事業所名', placeholder: '例：大阪支店、本社、第二工場' },
  { key: 'department', label: '部署' },
  { key: 'phone', label: '電話番号', required: true, placeholder: '例：06-1234-5678' },
  { key: 'address', label: '住所', wide: true },
  { key: 'nearestStation', label: '最寄駅' },
] as const;
type Key = (typeof FIELDS)[number]['key'];

function conflictOf(error: unknown): CreateOfficeConflict | null {
  if (!ApiError.isApiError(error) || error.code !== 'CONFLICT') return null;
  const details = error.details as CreateOfficeConflict | undefined;
  return details?.reason ? details : null;
}

/**
 * 別の事業所・支店を登録 (answer 11/10 No.10, No.11): another office learned about during a
 * call becomes a new company. The phone number alone decides whether it is registered already.
 * 業種・企業ランク・資本金 and the like are taken from the company being called.
 */
export function OfficeDialog({ company, open, onClose, onCreated }: OfficeDialogProps) {
  const create = useCreateOffice(company.id);
  const [values, setValues] = useState<Record<Key, string>>({
    name: company.name,
    office: '',
    department: '',
    phone: '',
    address: '',
    nearestStation: '',
  });
  const set = (key: Key, value: string) => {
    if (create.isError) create.reset();
    setValues((current) => ({ ...current, [key]: value }));
  };
  const phoneOk = PHONE_DIGITS_PATTERN.test(phoneDigitsOf(values.phone) ?? '');
  const ready = values.name.trim() !== '' && phoneOk;
  const conflict = conflictOf(create.error);

  const submit = () =>
    create.mutate(
      {
        name: values.name.trim(),
        office: values.office.trim() || null,
        department: values.department.trim() || null,
        phone: values.phone.trim(),
        address: values.address.trim() || null,
        nearestStation: values.nearestStation.trim() || null,
        // The same company: these stay the same as the company being called.
        url: company.url,
        industry: company.industry,
        companyRank: company.companyRank,
        parentName: company.parentName,
        capital: company.capital,
        customerType: company.customerType,
        listingStatus: company.listingStatus,
      },
      { onSuccess: onCreated },
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="別の事業所・支店を登録"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={submit} loading={create.isPending} disabled={!ready}>
            新しい企業として登録
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-ink-sub">
        電話で教えてもらった、同じ会社の別の事業所・支店を新しい企業として登録します。架電対象に入り、この企業と同じ会社として並びます。業種・企業ランク・資本金などは、この企業と同じ内容で登録します。
      </p>

      {conflict?.reason === 'phone_registered' && (
        <Alert
          tone="error"
          className="mb-4"
          action={
            <LinkButton size="sm" variant="secondary" to={paths.company(conflict.companyId)}>
              登録済みの企業を開く
            </LinkButton>
          }
        >
          この電話番号は登録済みのため、新しく作れません（
          <span data-no-translate>
            {conflict.companyName}
            {conflict.office ? ` ${conflict.office}` : ''}
          </span>
          ）。
        </Alert>
      )}
      {conflict?.reason === 'phone_avoided' && (
        <Alert tone="error" className="mb-4">
          この電話番号は回避企業のため、登録できません
          {conflict.companyName && (
            <>
              （<span data-no-translate>{conflict.companyName}</span>）
            </>
          )}
          。
        </Alert>
      )}
      {create.isError && !conflict && (
        <Alert tone="error" className="mb-4">
          {errorMessageOf(create.error)}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.key} className={'wide' in field ? 'sm:col-span-2' : undefined}>
            <FormField
              label={field.label}
              required={'required' in field}
              error={
                field.key === 'phone' && values.phone.trim() !== '' && !phoneOk
                  ? '10〜11桁の電話番号を入れてください'
                  : undefined
              }
            >
              {(c) => (
                <TextInput
                  {...c}
                  value={values[field.key]}
                  inputMode={field.key === 'phone' ? 'tel' : undefined}
                  placeholder={'placeholder' in field ? field.placeholder : undefined}
                  autoFocus={field.key === 'office'}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              )}
            </FormField>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

/** Shown on the company being called after the new office is registered. */
export function OfficeCreatedNotice({ created }: { created: CompanyDetail }) {
  return (
    <Alert
      tone="success"
      action={
        <Link to={paths.company(created.id)} className="text-sm font-bold text-link">
          登録した企業を開く
        </Link>
      }
    >
      <span data-no-translate>
        {created.name}
        {created.office ? ` ${created.office}` : ''}
      </span>
      を新しい企業として登録しました。
    </Alert>
  );
}
