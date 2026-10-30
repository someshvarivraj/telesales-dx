import {
  addMonthsToDate,
  AVOID_MONTH_CHOICES,
  type CallRecordDto,
  type CreateCallRecordRequest,
  gradeOfResult,
  jstDate,
  OptionCategory,
  UNCOUNTED_GRADE,
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
  resultCode: '',
  resultDetail: '',
  contactName: '',
  interestLevel: '',
  nextCallDate: null,
  avoidMonths: null,
  notes: '',
};

interface CallRecordFormProps {
  companyId: string;
  editing?: CallRecordDto;
  onSaved: (record: CallRecordDto) => void;
  onCancel?: () => void;
}

/** Grade A–E, the detailed result under it, B次回架電日 and C架電回避目安 (request 10/29). */
export function CallRecordForm({ companyId, editing, onSaved, onCancel }: CallRecordFormProps) {
  const save = useSaveCallRecord(companyId);
  const grades = useOptionList(OptionCategory.CallGrade);
  const results = useOptionList(OptionCategory.CallResult);
  const interest = useOptionList(OptionCategory.InterestLevel);
  const [values, setValues] = useState<CreateCallRecordRequest>(
    editing
      ? {
          ...editing,
          avoidMonths: editing.avoidMonths as CreateCallRecordRequest['avoidMonths'],
        }
      : empty,
  );
  const gradeResults = results.items.filter((item) => gradeOfResult(item.code) === values.grade);
  const chooseGrade = (grade: string) =>
    setValues((v) => ({
      ...v,
      grade,
      resultCode: v.resultCode && gradeOfResult(v.resultCode) === grade ? v.resultCode : '',
    }));
  const avoidFrom = editing ? jstDate(new Date(editing.calledAt)) : jstDate(new Date());
  const set = <K extends keyof CreateCallRecordRequest>(
    key: K,
    value: CreateCallRecordRequest[K],
  ) => setValues((v) => ({ ...v, [key]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    save.mutate(
      {
        id: editing?.id,
        request: {
          ...values,
          resultCode: values.resultCode || null,
          nextCallDate: values.nextCallDate || null,
          avoidMonths: values.grade === 'C' ? (values.avoidMonths ?? null) : null,
        },
      },
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {grades.items.map((grade) => (
            <button
              key={grade.code}
              type="button"
              aria-pressed={values.grade === grade.code}
              onClick={() => chooseGrade(grade.code)}
              className={cn(
                'flex min-h-12 cursor-pointer items-center justify-center gap-1.5 rounded-(--radius-control) border px-2 py-1.5 text-center text-sm leading-tight font-bold transition-colors',
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
        {values.grade === UNCOUNTED_GRADE && (
          <p className="mt-1.5 text-xs text-ink-sub">E は架電件数に数えません。</p>
        )}
      </fieldset>
      {gradeResults.length > 0 && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-bold">架電結果</legend>
          <div className="flex flex-wrap gap-2">
            {gradeResults.map((item) => (
              <button
                key={item.code}
                type="button"
                aria-pressed={values.resultCode === item.code}
                onClick={() => set('resultCode', values.resultCode === item.code ? '' : item.code)}
                className={cn(
                  'min-h-9 cursor-pointer rounded-(--radius-control) border px-3 py-1.5 text-sm transition-colors',
                  values.resultCode === item.code
                    ? 'border-main bg-main-soft font-bold text-main ring-1 ring-main'
                    : 'border-line bg-surface text-ink hover:border-main/60',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
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
        {values.grade === 'C' ? (
          <FormField
            label="C架電回避目安"
            hint={
              values.avoidMonths
                ? `${addMonthsToDate(avoidFrom, values.avoidMonths).replaceAll('-', '/')} から架電リストに戻ります`
                : undefined
            }
          >
            {(c) => (
              <Select
                {...c}
                value={values.avoidMonths ? String(values.avoidMonths) : ''}
                placeholder="―"
                options={AVOID_MONTH_CHOICES.map((choice) => ({
                  value: String(choice.months),
                  label: choice.label,
                }))}
                onChange={(e) =>
                  set(
                    'avoidMonths',
                    e.target.value
                      ? (Number(e.target.value) as CreateCallRecordRequest['avoidMonths'])
                      : null,
                  )
                }
              />
            )}
          </FormField>
        ) : (
          <FormField label="B次回架電日">
            {(c) => (
              <DatePicker
                {...c}
                value={values.nextCallDate ?? ''}
                onChange={(e) => set('nextCallDate', e.target.value || null)}
                clearable
              />
            )}
          </FormField>
        )}
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
