import { MeetingFormat, OptionCategory, Role } from '@telesales/shared';
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
  contactName: string;
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
  contactName: '',
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
          <FormField label={field.label} required={field.required}>
            {(c) => (
              <TextInput
                {...c}
                value={values[field.key]}
                onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
              />
            )}
          </FormField>
        </div>
      ))}
    </div>
  );
}

interface AppointmentFieldsProps {
  values: AppointmentValues;
  onChange: (values: AppointmentValues) => void;
  /** Telemarketing bookings show the booker and booking date (taken from the file when imported). */
  showBooker?: boolean;
}

/** The appointment details the rep and everyone involved will see (spec §1). */
export function AppointmentFields({
  values,
  onChange,
  showBooker = false,
}: AppointmentFieldsProps) {
  const customerTypes = useOptionList(OptionCategory.CustomerType);
  const telemas = usePeople(Role.Telema);
  const set = <K extends keyof AppointmentValues>(key: K, value: AppointmentValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-1 flex items-center gap-2 text-sm font-bold">
          訪問形態
          <span className="rounded-sm bg-danger-soft px-1.5 py-0.5 text-xs font-bold text-danger">
            {ja.common.required}
          </span>
        </legend>
        <div className="flex gap-6">
          {[MeetingFormat.Visit, MeetingFormat.Online].map((format) => (
            <Checkbox
              key={format}
              type="radio"
              name="format"
              value={format}
              label={ja.format[format]}
              checked={values.format === format}
              onChange={() => set('format', format)}
            />
          ))}
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
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="先方担当者（氏名）">
          {(c) => (
            <TextInput
              {...c}
              value={values.contactName}
              onChange={(e) => set('contactName', e.target.value)}
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
        <FormField label="先方TEL">
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
      {showBooker && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="アポ取得者" hint="空のときは自分になります。">
            {(c) => (
              <Select
                {...c}
                value={values.bookedById}
                placeholder="自分"
                options={(telemas.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                onChange={(e) => set('bookedById', e.target.value)}
              />
            )}
          </FormField>
          <FormField label="アポ取得日" hint="空のときは今日になります。">
            {(c) => (
              <DatePicker
                {...c}
                value={values.bookedOn}
                onChange={(e) => set('bookedOn', e.target.value)}
              />
            )}
          </FormField>
        </div>
      )}
    </div>
  );
}
