import {
  type AppointmentDetail,
  INDUSTRIES,
  MeetingFormat,
  ONLINE_TOOLS,
  OptionCategory,
  OTHER_FORMAT_EXAMPLES,
  Role,
} from '@telesales/shared';
import { Building2, MoreHorizontal, Phone, Video } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { cn } from '@/components/ui/cn';
import { DatePicker } from '@/components/ui/DatePicker';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { TextInput } from '@/components/ui/TextInput';
import { useOptionList, usePeople } from '@/features/reference/useReference';
import { ja } from '@/i18n/ja';

export interface CompanyValues {
  name: string;
  office: string;
  department: string;
  phone: string;
  url: string;
  address: string;
  nearestStation: string;
  industry: string;
  clientNo: string;
  listingStatus: string;
}

export interface AppointmentValues {
  format: MeetingFormat | '';
  visitAddress: string;
  onlineTool: string;
  formatNote: string;
  contactName: string;
  meetingPersonName: string;
  contactDepartment: string;
  contactPhone: string;
  contactEmail: string;
  handoverNotes: string;
  customerType: string;
  listName: string;
  isNewAppointment: boolean;
  bookedById: string;
  bookedOn: string;
}

export const emptyCompany: CompanyValues = {
  name: '',
  office: '',
  department: '',
  phone: '',
  url: '',
  address: '',
  nearestStation: '',
  industry: '',
  clientNo: '',
  listingStatus: '',
};

export const emptyAppointment: AppointmentValues = {
  format: '',
  visitAddress: '',
  onlineTool: '',
  formatNote: '',
  contactName: '',
  meetingPersonName: '',
  contactDepartment: '',
  contactPhone: '',
  contactEmail: '',
  handoverNotes: '',
  customerType: '',
  listName: '',
  isNewAppointment: false,
  bookedById: '',
  bookedOn: '',
};

/**
 * What still has to be filled in (shown with *). Telemarketing bookings also need who was spoken
 * to, their number and the handover notes: the rep works from them (11/2).
 */
export function missingAppointmentFields(values: AppointmentValues, telema: boolean): string[] {
  const missing: string[] = [];
  if (!values.format) missing.push('訪問形態');
  if (values.format === MeetingFormat.Other && !values.formatNote.trim())
    missing.push('その他の内容');
  if (telema) {
    if (!values.contactName.trim()) missing.push('先方担当者');
    if (!values.contactPhone.trim()) missing.push('先方TEL');
    if (!values.handoverNotes.trim()) missing.push('伝達事項');
  }
  return missing;
}

/** The appointment fields of a saved appointment, for editing. */
export function appointmentValuesOf(appointment: AppointmentDetail): AppointmentValues {
  return {
    format: appointment.format,
    visitAddress: appointment.visitAddress ?? '',
    onlineTool: appointment.onlineTool ?? '',
    formatNote: appointment.formatNote ?? '',
    contactName: appointment.contactName ?? '',
    meetingPersonName: appointment.meetingPersonName ?? '',
    contactDepartment: appointment.contactDepartment ?? '',
    contactPhone: appointment.contactPhone ?? '',
    contactEmail: appointment.contactEmail ?? '',
    handoverNotes: appointment.handoverNotes ?? '',
    customerType: appointment.customerType ?? '',
    listName: appointment.listName ?? '',
    isNewAppointment: appointment.isNewAppointment,
    bookedById: appointment.bookedBy.id,
    bookedOn: '',
  };
}

/** The request fields shared by booking and editing (empty → null). */
export function appointmentRequestFields(values: AppointmentValues) {
  return {
    visitAddress: values.visitAddress || null,
    onlineTool: values.format === MeetingFormat.Online ? values.onlineTool || null : null,
    formatNote: values.format === MeetingFormat.Other ? values.formatNote || null : null,
    contactName: values.contactName || null,
    meetingPersonName: values.meetingPersonName || null,
    contactDepartment: values.contactDepartment || null,
    contactPhone: values.contactPhone || null,
    contactEmail: values.contactEmail || null,
    handoverNotes: values.handoverNotes || null,
    customerType: values.customerType || null,
    listName: values.listName || null,
    isNewAppointment: values.isNewAppointment,
  };
}

const COMPANY_FIELDS: {
  key: keyof CompanyValues;
  label: string;
  wide?: boolean;
  required?: boolean;
}[] = [
  { key: 'name', label: '会社名', required: true, wide: true },
  { key: 'phone', label: '代表TEL' },
  { key: 'clientNo', label: 'クライアントNo' },
  { key: 'address', label: '住所', wide: true },
  { key: 'office', label: '事業所' },
  { key: 'department', label: '部署' },
  { key: 'nearestStation', label: '最寄駅' },
  { key: 'industry', label: '業種' },
  { key: 'url', label: 'URL', wide: true },
];

export function CompanyFields({
  values,
  onChange,
}: {
  values: CompanyValues;
  onChange: (values: CompanyValues) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {COMPANY_FIELDS.map((field) => (
        <div key={field.key} className={field.wide ? 'sm:col-span-2' : undefined}>
          <FormField
            label={field.label}
            required={field.required}
            hint={
              field.key === 'industry'
                ? 'リスト取り込みと同じ一覧から選びます。ないときは「その他」。'
                : undefined
            }
          >
            {(c) =>
              field.key === 'industry' ? (
                // The same fixed list as the list import (answer 11/10 No.5).
                <Select
                  {...c}
                  value={values.industry}
                  placeholder="―"
                  options={[
                    // A value read from the file that is not on the list stays visible.
                    ...(values.industry && !INDUSTRIES.includes(values.industry)
                      ? [{ value: values.industry, label: values.industry }]
                      : []),
                    ...INDUSTRIES.map((value) => ({ value, label: value })),
                  ]}
                  onChange={(e) => onChange({ ...values, industry: e.target.value })}
                />
              ) : (
                <TextInput
                  {...c}
                  value={values[field.key]}
                  onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
                />
              )
            }
          </FormField>
        </div>
      ))}
    </div>
  );
}

interface AppointmentFieldsProps {
  values: AppointmentValues;
  onChange: (values: AppointmentValues) => void;
  /** Telemarketing bookings: the booker, and who was spoken to / handover notes are required. */
  telema?: boolean;
  /** Show the booking date too (new bookings; it is fixed once registered). */
  showBookedOn?: boolean;
}

const FORMAT_CHOICES: { format: MeetingFormat; icon: ReactNode; hint: string }[] = [
  { format: MeetingFormat.Visit, icon: <Building2 className="size-5" />, hint: '先方へ伺う' },
  { format: MeetingFormat.Online, icon: <Video className="size-5" />, hint: 'Zoom・Meet など' },
  { format: MeetingFormat.Phone, icon: <Phone className="size-5" />, hint: '電話で話す' },
  { format: MeetingFormat.Other, icon: <MoreHorizontal className="size-5" />, hint: '来社など' },
];

/** Picks one of a few common answers, or lets the person type their own. */
function ChoiceChips({
  label,
  choices,
  value,
  onChange,
  required = false,
  placeholder,
}: {
  label: string;
  choices: readonly string[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder: string;
}) {
  const typed = value !== '' && !choices.includes(value);
  const [typing, setTyping] = useState(typed);
  const chip = (on: boolean) =>
    cn(
      'inline-flex h-9 items-center border px-3 text-sm transition-colors',
      on
        ? 'border-main bg-main-soft font-bold text-main'
        : 'border-line-strong bg-surface hover:border-main-line',
    );
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 flex items-baseline gap-1.5 text-[13px] font-bold">
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="text-danger">
              *
            </span>
            <span className="sr-only">{ja.common.required}</span>
          </>
        )}
      </legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            aria-pressed={!typing && value === choice}
            className={chip(!typing && value === choice)}
            onClick={() => {
              setTyping(false);
              onChange(value === choice ? '' : choice);
            }}
          >
            {choice}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={typing}
          className={chip(typing)}
          onClick={() => {
            setTyping(true);
            if (choices.includes(value)) onChange('');
          }}
        >
          その他（入力）
        </button>
      </div>
      {typing && (
        <TextInput
          aria-label={label}
          aria-required={required}
          className="max-w-md"
          placeholder={placeholder}
          value={value}
          maxLength={100}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </fieldset>
  );
}

/** The appointment details the rep and everyone involved will see (spec §1). */
export function AppointmentFields({
  values,
  onChange,
  telema = false,
  showBookedOn = false,
}: AppointmentFieldsProps) {
  const customerTypes = useOptionList(OptionCategory.CustomerType);
  const telemas = usePeople(Role.Telema);
  const set = <K extends keyof AppointmentValues>(key: K, value: AppointmentValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-ink-sub">
        <span className="text-danger">*</span> は必ず入力してください。
      </p>
      <fieldset>
        <legend className="mb-2 flex items-baseline gap-1.5 text-[13px] font-bold">
          訪問形態
          <span aria-hidden="true" className="text-danger">
            *
          </span>
          <span className="sr-only">{ja.common.required}</span>
        </legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FORMAT_CHOICES.map(({ format, icon, hint }) => {
            const on = values.format === format;
            return (
              <button
                key={format}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set('format', format)}
                className={cn(
                  'flex items-center gap-2.5 border px-3 py-2.5 text-left transition-[border-color,box-shadow,background-color]',
                  on
                    ? 'border-main bg-main-soft shadow-[0_0_0_1px_var(--color-main)]'
                    : 'border-line-strong bg-surface hover:border-main-line',
                )}
              >
                <span aria-hidden="true" className={on ? 'text-main' : 'text-ink-sub'}>
                  {icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{ja.format[format]}</span>
                  <span className="block truncate text-xs text-ink-sub">{hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      {values.format === MeetingFormat.Visit && (
        <FormField label="訪問先住所" hint="空のときは企業の住所を使います。">
          {(c) => (
            <TextInput
              {...c}
              value={values.visitAddress}
              onChange={(e) => set('visitAddress', e.target.value)}
            />
          )}
        </FormField>
      )}
      {values.format === MeetingFormat.Online && (
        <ChoiceChips
          label="使うツール"
          choices={ONLINE_TOOLS}
          value={values.onlineTool}
          onChange={(value) => set('onlineTool', value)}
          placeholder="例：Webex、先方の会議システム"
        />
      )}
      {values.format === MeetingFormat.Other && (
        <ChoiceChips
          label="その他の内容"
          choices={OTHER_FORMAT_EXAMPLES}
          value={values.formatNote}
          onChange={(value) => set('formatNote', value)}
          required
          placeholder="例：先方が当社へ来社"
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="先方担当者（電話で話した方）" required={telema}>
          {(c) => (
            <TextInput
              {...c}
              value={values.contactName}
              onChange={(e) => set('contactName', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="面談される方" hint="電話で話した方と違うときだけ入力します。">
          {(c) => (
            <TextInput
              {...c}
              value={values.meetingPersonName}
              onChange={(e) => set('meetingPersonName', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="先方の部署">
          {(c) => (
            <TextInput
              {...c}
              value={values.contactDepartment}
              onChange={(e) => set('contactDepartment', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="先方TEL" required={telema}>
          {(c) => (
            <TextInput
              {...c}
              type="tel"
              value={values.contactPhone}
              onChange={(e) => set('contactPhone', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="先方Mail">
          {(c) => (
            <TextInput
              {...c}
              type="email"
              value={values.contactEmail}
              onChange={(e) => set('contactEmail', e.target.value)}
            />
          )}
        </FormField>
      </div>
      <FormField
        label="伝達事項"
        required={telema}
        hint="アポが取れたときの状況。営業さんへのメールにそのまま入ります。"
      >
        {(c) => (
          <Textarea
            {...c}
            rows={6}
            value={values.handoverNotes}
            onChange={(e) => set('handoverNotes', e.target.value)}
          />
        )}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
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
        <FormField label="テレマリスト名">
          {(c) => (
            <TextInput
              {...c}
              value={values.listName}
              onChange={(e) => set('listName', e.target.value)}
            />
          )}
        </FormField>
      </div>
      <Checkbox
        label="新規アポ（報告用Excelの ● ）"
        checked={values.isNewAppointment}
        onChange={(e) => set('isNewAppointment', e.target.checked)}
      />
      {telema && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="アポ取得者"
            hint={
              showBookedOn
                ? '空のときは自分になります。登録する人と違うときは選んでください。'
                : 'アポを取ったテレマ。登録した人と違うときは直してください。'
            }
          >
            {(c) => (
              <Select
                {...c}
                value={values.bookedById}
                placeholder={showBookedOn ? '自分' : '―'}
                options={(telemas.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                onChange={(e) => set('bookedById', e.target.value)}
              />
            )}
          </FormField>
          {showBookedOn && (
            <FormField label="アポ取得日" hint="空のときは今日になります。">
              {(c) => (
                <DatePicker
                  {...c}
                  value={values.bookedOn}
                  onChange={(e) => set('bookedOn', e.target.value)}
                />
              )}
            </FormField>
          )}
        </div>
      )}
    </div>
  );
}
