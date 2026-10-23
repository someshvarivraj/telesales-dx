import {
  type AppointmentDetail,
  type AppointmentFilePrefill,
  type CallRecordDto,
  type CompanyDetail,
  AppointmentSource,
  type CreateAppointmentRequest,
  jstDate,
  jstTime,
  MeetingFormat,
  OptionCategory,
  Permission,
} from '@telesales/shared';
import { Check, FileSpreadsheet, FileText, PencilLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { Dialog } from '@/components/ui/Dialog';
import { FileDrop } from '@/components/ui/FileDrop';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { useAppointment, useCreateAppointment, usePrefill } from '@/features/appointments/api';
import {
  AppointmentFields,
  type AppointmentValues,
  CompanyFields,
  type CompanyValues,
  emptyAppointment,
  emptyCompany,
} from '@/features/appointments/AppointmentFields';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { FindRepDialog } from '@/features/calls/FindRepDialog';
import { useCallRecords, useCompany } from '@/features/calls/api';
import { useOptionList, usePeople } from '@/features/reference/useReference';
import { ApiError } from '@/lib/api/ApiError';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { defaultEndTime, formatDate, todayJst, toInstant } from '@/lib/format';
import { ja } from '@/i18n/ja';
import { type Slot, SlotPicker } from './SlotPicker';
import { slotProblemText } from './slotProblems';
import { useSlotLock } from './useSlotLock';

type Source = (typeof AppointmentSource)[keyof typeof AppointmentSource];

/** Empty inputs are sent as null. */
function emptyToNull<T extends object>(values: T): { [K in keyof T]: T[K] | null } {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value === '' ? null : value]),
  ) as {
    [K in keyof T]: T[K] | null;
  };
}

/**
 * Booking (spec §6): find the rep → check free/busy → hold the slot → fill in the details
 * (auto from ①, from the CSV/PDF, or by hand) → confirmation → register → N1 preview.
 *
 * The rep and the time always come from the held slot. For an existing list the rep is
 * decided from the sales area table and the slot is held while the call is still going;
 * the telemarketing system's CSV only exists after the result has been entered there and
 * has no rep column, so the files are read last and only fill in the details.
 */
export function BookingPage() {
  const [params] = useSearchParams();
  const rebookOf = params.get('rebookOf');
  const original = useAppointment(rebookOf ?? '');
  const companyId = params.get('companyId') ?? original.data?.company.id ?? null;
  const company = useCompany(companyId ?? '');
  const records = useCallRecords(companyId ?? '');
  if (original.isLoading || company.isLoading || records.isLoading) {
    return (
      <div className="flex justify-center py-16 text-ink-sub">
        <Spinner className="size-6" label={ja.common.loading} />
      </div>
    );
  }
  return (
    <BookingForm
      key={`${rebookOf ?? ''}:${companyId ?? ''}`}
      original={original.data ?? null}
      company={company.data ?? null}
      records={records.data ?? []}
    />
  );
}

interface BookingFormProps {
  /** Re-booking after cancellation: start from the original appointment. */
  original: AppointmentDetail | null;
  /** New list (①): fill in from the company and the call record. */
  company: CompanyDetail | null;
  records: CallRecordDto[];
}

function initialValues(
  params: URLSearchParams,
  props: BookingFormProps,
  source: Source,
): AppointmentValues {
  const { original, company, records } = props;
  if (original) {
    return {
      format: original.format,
      visitAddress: original.visitAddress ?? '',
      contactName: original.contactName ?? '',
      contactDepartment: original.contactDepartment ?? '',
      contactPhone: original.contactPhone ?? '',
      contactEmail: original.contactEmail ?? '',
      handoverNotes: original.handoverNotes ?? '',
      customerType: original.customerType ?? '',
      listName: original.listName ?? '',
      isNewAppointment: original.isNewAppointment,
      bookedById: '',
      bookedOn: '',
    };
  }
  const latest = records.find((record) => record.id === params.get('callRecordId')) ?? records[0];
  return {
    ...emptyAppointment,
    format: params.get('format') === 'ONLINE' ? MeetingFormat.Online : '',
    customerType: company?.customerType ?? '',
    listName: company?.listName ?? '',
    contactName: latest?.contactName ?? '',
    contactDepartment: company?.department ?? '',
    handoverNotes: [latest?.resultDetail, latest?.notes].filter(Boolean).join('\n'),
    isNewAppointment: source === AppointmentSource.CallStatus,
  };
}

function BookingForm(props: BookingFormProps) {
  const { original, company } = props;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const canTelema = usePermission(Permission.ManageTelemaAppointments);
  const isAdmin = usePermission(Permission.Administer);
  const rebookOf = original?.id ?? null;
  const [source, setSource] = useState<Source>(
    () =>
      original?.source ??
      (params.get('source') as Source | null) ??
      // Existing list: the telemarketing system's CSV is the usual way in (flow v4).
      (canTelema ? AppointmentSource.File : AppointmentSource.SalesBooked),
  );
  const companyId = company?.id ?? null;
  const customerTypes = useOptionList(OptionCategory.CustomerType);
  const people = usePeople();
  const lock = useSlotLock();
  const create = useCreateAppointment();
  const prefill = usePrefill();
  // Existing list without a rep yet: start by finding the rep from the area table (flow v4 §1).
  const [findRep, setFindRep] = useState(
    () =>
      canTelema &&
      !original &&
      !company &&
      !params.get('repId') &&
      params.get('source') === AppointmentSource.File,
  );
  const [confirming, setConfirming] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [prefilled, setPrefilled] = useState<AppointmentFilePrefill | null>(null);
  const salesBooked = source === AppointmentSource.SalesBooked;

  const [slot, setSlot] = useState<Slot>(() => {
    const start = '10:00';
    return {
      repId: original?.salesRep.id ?? params.get('repId') ?? (salesBooked ? user.id : ''),
      date: params.get('date') ?? todayJst(),
      start,
      end: defaultEndTime(start),
    };
  });
  const [companyValues, setCompanyValues] = useState<CompanyValues>(emptyCompany);
  const [values, setValues] = useState<AppointmentValues>(() =>
    initialValues(params, props, source),
  );

  const readFiles = (selected: File[], rowIndex?: number) => {
    const list = selected.slice(0, 2);
    setFiles(list);
    prefill.mutate(
      { files: list, rowIndex },
      {
        onSuccess: (data) => {
          setPrefilled(data);
          const c = data.company;
          setCompanyValues({
            name: c.name ?? '',
            office: c.office ?? '',
            department: c.department ?? '',
            phone: c.phone ?? '',
            url: '',
            address: c.address ?? '',
            nearestStation: c.nearestStation ?? '',
            industry: c.industry ?? '',
            clientNo: c.clientNo ?? '',
            listingStatus: c.listingStatus ?? '',
          });
          setValues((current) => ({
            ...current,
            format: current.format || data.suggestedFormat || '',
            contactName: data.contactName ?? current.contactName,
            contactPhone: data.contactPhone ?? current.contactPhone,
            handoverNotes: data.handoverNotes ?? current.handoverNotes,
            listName: data.listName ?? current.listName,
            bookedById: data.bookedBy?.id ?? current.bookedById,
            bookedOn: data.bookedOn ?? current.bookedOn,
          }));
        },
      },
    );
  };

  const fileWarnings: string[] = [...(prefilled?.warnings ?? [])];
  if (prefilled?.startsAt) {
    const fileStart = new Date(prefilled.startsAt);
    if (jstDate(fileStart) !== slot.date || jstTime(fileStart) !== slot.start) {
      fileWarnings.push(
        `ファイルの訪問日時（${formatDate(jstDate(fileStart))} ${jstTime(fileStart)}）と、選んだ枠が違います。`,
      );
    }
  }
  if (prefilled?.salesRep && prefilled.salesRep.id !== slot.repId) {
    fileWarnings.push(
      `ファイルの営業担当（${prefilled.salesRep.name}）と、選んだ担当営業が違います。`,
    );
  }

  const needsCompany = !companyId;
  const held = lock.state.status === 'held';
  const ready = held && values.format !== '' && (!needsCompany || companyValues.name.trim() !== '');

  const request = (): CreateAppointmentRequest => ({
    source,
    companyId,
    company: needsCompany
      ? { ...emptyToNull(companyValues), name: companyValues.name.trim() }
      : null,
    sourceCallRecordId:
      source === AppointmentSource.CallStatus ? (params.get('callRecordId') ?? null) : null,
    sourceFileIds: source === AppointmentSource.File ? (prefilled?.fileIds ?? []) : [],
    sourceRowKey: source === AppointmentSource.File ? (prefilled?.sourceRowKey ?? null) : null,
    salesRepId: slot.repId,
    startsAt: toInstant(slot.date, slot.start),
    endsAt: toInstant(slot.date, slot.end),
    format: values.format as MeetingFormat,
    bookedById: values.bookedById || null,
    bookedOn: values.bookedOn || null,
    originalAppointmentId: rebookOf,
    visitAddress: values.visitAddress || null,
    contactName: values.contactName || null,
    contactDepartment: values.contactDepartment || null,
    contactPhone: values.contactPhone || null,
    contactEmail: values.contactEmail || null,
    handoverNotes: values.handoverNotes || null,
    customerType: values.customerType || null,
    listName: values.listName || null,
    isNewAppointment: values.isNewAppointment,
  });

  const submit = () =>
    create.mutate(request(), {
      onSuccess: (appointment) => {
        lock.forget();
        navigate(paths.appointmentMail(appointment.id, 'booking'), { replace: true });
      },
      onError: () => setConfirming(false),
    });

  const createError = create.error;
  const duplicateOf =
    ApiError.isApiError(createError) && createError.code === 'DUPLICATE_FILE'
      ? (createError.details as { appointmentId?: string } | undefined)?.appointmentId
      : undefined;
  const rep = people.data?.find((person) => person.id === slot.repId);

  return (
    <>
      <PageHeader
        eyebrow={ja.module.schedule}
        title={rebookOf ? '再アポの登録' : salesBooked ? '自分で取ったアポの登録' : 'アポの登録'}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex flex-col gap-5">
          {original && (
            <Alert tone="info">
              取り消したアポ（{formatDate(jstDate(new Date(original.startsAt)))}
              ）とつながった新しいアポになります。集計では二重に数えません。
            </Alert>
          )}
          {company && (
            <Alert tone="info">
              <span className="font-bold">{company.name}</span>（{company.phone}
              ）のアポを登録します。企業情報は ① から自動で入ります。
            </Alert>
          )}

          <StepCard
            step={1}
            done={held}
            title="日時と担当営業"
            actions={
              !salesBooked && !companyId && !rebookOf && !held ? (
                <Button variant="secondary" onClick={() => setFindRep(true)}>
                  エリアと取引区分から担当営業を判定
                </Button>
              ) : undefined
            }
          >
            {!salesBooked && !companyId && !rebookOf && !held && (
              <p className="mb-4 text-sm text-ink-sub">
                既存リストは、架電の前に営業担当表（エリア＋取引区分）で担当営業を決め、話している間にこの枠を押さえます。
              </p>
            )}
            <SlotPicker
              slot={slot}
              onChange={setSlot}
              lock={lock.state}
              repLocked={salesBooked && !isAdmin}
              salesBooked={salesBooked}
              onLock={() =>
                void lock.acquire(
                  slot.repId,
                  toInstant(slot.date, slot.start),
                  toInstant(slot.date, slot.end),
                )
              }
              onUnlock={() => void lock.release()}
            />
          </StepCard>

          {needsCompany && !salesBooked && !rebookOf && (
            <StepCard
              step={2}
              done={Boolean(prefilled) || source === AppointmentSource.Manual}
              title="既存リストの読み込み"
            >
              <div className="flex flex-col gap-4">
                <div role="radiogroup" aria-label="入れ方" className="grid gap-3 sm:grid-cols-2">
                  <ChoiceCard
                    on={source === AppointmentSource.File}
                    onClick={() => setSource(AppointmentSource.File)}
                    icon={<FileSpreadsheet className="size-5" />}
                    title="CSV・帳票PDFから読み込む"
                    text="テレマシステムのCSVと伝達事項PDFで自動入力"
                  />
                  <ChoiceCard
                    on={source === AppointmentSource.Manual}
                    onClick={() => setSource(AppointmentSource.Manual)}
                    icon={<PencilLine className="size-5" />}
                    title="手で入力する"
                    text="ファイルがないときはこちら"
                  />
                </div>
                {source === AppointmentSource.File && (
                  <>
                    {!held && (
                      <Alert tone="info">
                        アポが決まったら、テレマシステムに結果を入れてCSVを出し、ここで読み込みます。先に「1.
                        日時と担当営業」で枠を押さえてください。
                      </Alert>
                    )}
                    <FileDrop
                      accept=".csv,.pdf,text/csv,application/pdf"
                      multiple
                      hint="テレマシステムのCSV（Shift-JIS）と「営業さんへの伝達事項」のPDF。どちらか一方でも、両方でも。日時と担当営業は押さえた枠のまま変わりません。"
                      onFiles={(selected) => readFiles(selected)}
                      disabled={!held || prefill.isPending}
                    />
                    {files.length > 0 && (
                      <ul className="flex flex-wrap gap-2 text-sm">
                        {files.map((file) => (
                          <li
                            key={file.name}
                            className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1"
                          >
                            <FileText className="size-4 text-ink-sub" aria-hidden="true" />
                            {file.name}
                          </li>
                        ))}
                      </ul>
                    )}
                    {prefill.isPending && <p className="text-sm text-ink-sub">読み込み中…</p>}
                    {prefill.isError && (
                      <Alert tone="error">
                        ファイルを読み込めませんでした。下の項目に手で入力してください。（
                        {errorMessageOf(prefill.error)}）
                      </Alert>
                    )}
                    {prefilled?.alreadyImportedAppointmentId && (
                      <Alert tone="error">
                        このファイルはすでにアポとして登録されています。
                        <Link
                          to={paths.appointment(prefilled.alreadyImportedAppointmentId)}
                          className="ml-2 font-bold text-link hover:underline"
                        >
                          登録済みのアポを開く
                        </Link>
                      </Alert>
                    )}
                    {prefilled && prefilled.csvRows.length > 1 && (
                      <div className="max-w-xl">
                        <Select
                          aria-label="CSVの行"
                          value={prefilled.sourceRowKey?.replace('row:', '') ?? ''}
                          placeholder="CSVに複数の行があります。使う行を選んでください"
                          options={prefilled.csvRows.map((row) => ({
                            value: String(row.index),
                            label: `${row.index + 1}行目：${row.name}（${row.listName ?? ''} ${row.calledOn ?? ''}）`,
                          }))}
                          onChange={(e) =>
                            e.target.value && readFiles(files, Number(e.target.value))
                          }
                        />
                      </div>
                    )}
                    {prefilled && (
                      <p className="text-sm text-success">
                        読み込みました。下の内容を確かめて、足りない所を入力してください。
                      </p>
                    )}
                  </>
                )}
              </div>
            </StepCard>
          )}

          {needsCompany && (
            <StepCard
              step={salesBooked ? 2 : 3}
              done={companyValues.name.trim() !== ''}
              title="企業"
            >
              {prefilled?.matchedCompanyId && (
                <Alert tone="info" className="mb-4">
                  企業台帳に同じ企業があります。登録するとその企業にアポをつなぎます。
                </Alert>
              )}
              <CompanyFields values={companyValues} onChange={setCompanyValues} />
            </StepCard>
          )}

          <StepCard
            step={needsCompany ? (salesBooked ? 3 : 4) : 2}
            done={values.format !== ''}
            title="アポの内容"
          >
            {fileWarnings.length > 0 && (
              <Alert tone="warning" className="mb-4">
                {fileWarnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </Alert>
            )}
            <AppointmentFields values={values} onChange={setValues} showBooker={!salesBooked} />
          </StepCard>

          {createError && (
            <Alert tone="error">
              {errorMessageOf(createError)}
              {ApiError.isApiError(createError) && Array.isArray(createError.details) && (
                <ul className="mt-1 list-inside list-disc">
                  {createError.details.map((problem, index) => (
                    <li key={index}>{slotProblemText(problem)}</li>
                  ))}
                </ul>
              )}
              {duplicateOf && (
                <Link
                  to={paths.appointment(duplicateOf)}
                  className="ml-2 font-bold text-link hover:underline"
                >
                  登録済みのアポを開く
                </Link>
              )}
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 lg:hidden">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              キャンセル
            </Button>
            <Button size="lg" disabled={!ready} onClick={() => setConfirming(true)}>
              確認画面へ
            </Button>
          </div>
        </div>

        {/* Summary: what will be booked, and what is still missing. */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4" aria-label="登録内容のまとめ">
          <section className="border border-line bg-surface shadow-(--shadow-card)">
            <div className="border-b border-line bg-column px-4 py-3">
              <p className="text-[11px] font-bold text-ink-sub">登録するアポ</p>
              <p className="mt-0.5 truncate text-base font-bold">
                {company?.name ??
                  original?.company.name ??
                  (companyValues.name || '（会社名未入力）')}
              </p>
            </div>
            <dl className="flex flex-col gap-2.5 px-4 py-3 text-sm">
              <SummaryRow label="日時">
                {formatDate(slot.date)}
                <br />
                <span className="font-bold tabular-nums">
                  {slot.start}〜{slot.end}
                </span>
              </SummaryRow>
              <SummaryRow label="担当営業">{rep?.name ?? '―'}</SummaryRow>
              <SummaryRow label="訪問形態">
                {values.format ? ja.format[values.format] : '―'}
              </SummaryRow>
              <SummaryRow label="登録元">{ja.source[source]}</SummaryRow>
            </dl>
            <ol className="flex flex-col gap-1.5 border-t border-line px-4 py-3 text-sm">
              <Todo done={held}>枠を押さえる</Todo>
              {needsCompany && <Todo done={companyValues.name.trim() !== ''}>会社名を入れる</Todo>}
              <Todo done={values.format !== ''}>訪問形態を選ぶ</Todo>
            </ol>
            <div className="flex flex-col gap-2 border-t border-line p-4">
              <Button size="lg" fullWidth disabled={!ready} onClick={() => setConfirming(true)}>
                確認画面へ
              </Button>
              <Button variant="text" fullWidth onClick={() => navigate(-1)}>
                キャンセル
              </Button>
              {!held && (
                <p className="text-center text-xs text-ink-sub">
                  先に「この枠を押さえる」を押してください。
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="この内容で登録しますか？"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              戻って直す
            </Button>
            <Button loading={create.isPending} onClick={submit}>
              登録する
            </Button>
          </>
        }
      >
        <DescriptionList
          items={[
            {
              label: '会社名',
              value: company?.name ?? original?.company.name ?? companyValues.name,
              wide: true,
            },
            { label: '訪問日時', value: `${formatDate(slot.date)} ${slot.start}〜${slot.end}` },
            { label: '担当営業', value: rep?.name },
            { label: '訪問形態', value: values.format ? ja.format[values.format] : '' },
            { label: '取引区分', value: customerTypes.labelOf(values.customerType) },
            { label: '先方担当者', value: values.contactName },
            { label: '先方TEL', value: values.contactPhone },
            { label: '伝達事項', value: values.handoverNotes, wide: true },
            { label: 'テレマリスト名', value: values.listName },
            { label: '登録元', value: ja.source[source] },
          ]}
        />
        <p className="mt-4 text-sm text-ink-sub">
          登録すると担当営業に画面でお知らせし、続けて営業さんへのメール（N1）の確認画面を開きます。
        </p>
      </Dialog>

      <FindRepDialog
        open={findRep}
        onClose={() => setFindRep(false)}
        onChoose={(repId, webOnly) => {
          setFindRep(false);
          setSlot((current) => ({ ...current, repId }));
          if (webOnly)
            setValues((current) => ({
              ...current,
              format: current.format || MeetingFormat.Online,
            }));
        }}
      />
    </>
  );
}

function StepCard({
  step,
  title,
  done,
  actions,
  children,
}: {
  step: number;
  title: string;
  done: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border border-line bg-surface shadow-(--shadow-card)">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-7 items-center justify-center text-sm font-bold transition-colors',
            done ? 'bg-success text-white' : 'bg-ink text-white',
          )}
        >
          {done ? <Check className="size-4" /> : step}
        </span>
        <h2 className="text-base font-bold">
          <span className="sr-only">{step}. </span>
          {title}
        </h2>
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ChoiceCard({
  on,
  onClick,
  icon,
  title,
  text,
}: {
  on: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-start gap-3 border p-4 text-left transition-[border-color,box-shadow,background-color]',
        on
          ? 'border-main bg-main-soft shadow-[0_0_0_1px_var(--color-main)]'
          : 'border-line-strong bg-surface hover:border-main-line',
      )}
    >
      <span aria-hidden="true" className={cn('mt-0.5', on ? 'text-main' : 'text-ink-sub')}>
        {icon}
      </span>
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs text-ink-sub">{text}</span>
      </span>
    </button>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-2">
      <dt className="text-xs text-ink-sub">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Todo({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <li className={cn('flex items-center gap-2', done ? 'text-ink-sub line-through' : 'text-ink')}>
      <span
        aria-hidden="true"
        className={cn(
          'flex size-4 items-center justify-center border',
          done ? 'border-success bg-success text-white' : 'border-line-strong',
        )}
      >
        {done && <Check className="size-3" />}
      </span>
      <span className="sr-only">{done ? '済み：' : '未：'}</span>
      {children}
    </li>
  );
}
