import {
  type CallRecordDto,
  type CreateCallRecordRequest,
  OptionCategory,
} from '@telesales/shared';
import { useState } from 'react';
import { DatePicker } from '@/components/ui/DatePicker';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { TextInput } from '@/components/ui/TextInput';
import { useOptionList } from '@/features/reference/useReference';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { useSaveCallRecord } from './api';

const empty: CreateCallRecordRequest = {
  grade: '',
  resultDetail: '',
  contactName: '',
  interestLevel: '',
  nextCallDate: null,
  notes: '',
};

interface CallRecordFormProps {
  companyId: string;
  editing?: CallRecordDto;
  onSaved: (record: CallRecordDto) => void;
  onCancel?: () => void;
}

/** Grade A–D, detail, next call date (spec §6). */
export function CallRecordForm({ companyId, editing, onSaved, onCancel }: CallRecordFormProps) {
  const save = useSaveCallRecord(companyId);
  const grades = useOptionList(OptionCategory.CallGrade);
  const interest = useOptionList(OptionCategory.InterestLevel);
  const [values, setValues] = useState<CreateCallRecordRequest>(editing ? { ...editing } : empty);
  const set = <K extends keyof CreateCallRecordRequest>(
    key: K,
    value: CreateCallRecordRequest[K],
  ) => setValues((v) => ({ ...v, [key]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    save.mutate(
      { id: editing?.id, request: { ...values, nextCallDate: values.nextCallDate || null } },
      {
        onSuccess: (record) => {
          if (!editing) setValues(empty);
          onSaved(record);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {save.isError && <Alert tone="error">{errorMessageOf(save.error)}</Alert>}
      <fieldset>
        <legend className="mb-1.5 text-sm font-bold">判定</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {grades.items.map((grade) => (
            <button
              key={grade.code}
              type="button"
              aria-pressed={values.grade === grade.code}
              onClick={() => set('grade', grade.code)}
              className={cn(
                'flex h-12 cursor-pointer items-center justify-center gap-1.5 rounded-(--radius-control) border text-sm font-bold transition-colors',
                values.grade === grade.code
                  ? 'border-main bg-main text-white'
                  : 'border-line bg-surface text-ink hover:border-main/60',
              )}
            >
              <span className="text-base">{grade.code}</span>
              {grade.label}
            </button>
          ))}
        </div>
      </fieldset>
      <FormField label="結果詳細">
        {(c) => (
          <Textarea
            {...c}
            rows={3}
            value={values.resultDetail ?? ''}
            onChange={(e) => set('resultDetail', e.target.value)}
          />
        )}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="先方担当者">
          {(c) => (
            <TextInput
              {...c}
              value={values.contactName ?? ''}
              onChange={(e) => set('contactName', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="乗り気度">
          {(c) => (
            <Select
              {...c}
              value={values.interestLevel ?? ''}
              placeholder="―"
              options={interest.selectOptions}
              onChange={(e) => set('interestLevel', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="次回架電日">
          {(c) => (
            <DatePicker
              {...c}
              value={values.nextCallDate ?? ''}
              onChange={(e) => set('nextCallDate', e.target.value || null)}
              clearable
            />
          )}
        </FormField>
      </div>
      <FormField label="メモ">
        {(c) => (
          <Textarea
            {...c}
            rows={2}
            value={values.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
          />
        )}
      </FormField>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            キャンセル
          </Button>
        )}
        <Button type="submit" loading={save.isPending} disabled={!values.grade}>
          {editing ? '更新する' : '架電結果を保存'}
        </Button>
      </div>
    </form>
  );
}
