import {
  type AppointmentListQuery,
  type AppointmentStatus,
  OptionCategory,
  Role,
} from '@telesales/shared';
import { Download, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { Pagination } from '@/components/ui/Pagination';
import { QueryState } from '@/components/ui/QueryState';
import { Select } from '@/components/ui/Select';
import { Table, Td, Th } from '@/components/ui/Table';
import { TextInput } from '@/components/ui/TextInput';
import { useOptionList, usePeople } from '@/features/reference/useReference';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDate, formatRange, todayJst } from '@/lib/format';
import { ja } from '@/i18n/ja';
import { jstDate } from '@telesales/shared';
import { downloadReport, useAppointments } from './api';
import {
  AppointmentStatusBadge,
  ChangeRequestBadge,
  ConfirmedBadge,
  FormatBadge,
} from './AppointmentBadges';

function monthStart(): string {
  return `${todayJst().slice(0, 8)}01`;
}

/** Appointment list for any period, and the report Excel download (spec §6). */
export function AppointmentListPage() {
  const reps = usePeople(Role.Sales);
  const telemas = usePeople(Role.Telema);
  const customerTypes = useOptionList(OptionCategory.CustomerType);
  const [filters, setFilters] = useState<AppointmentListQuery>({ from: todayJst() });
  const [applied, setApplied] = useState<AppointmentListQuery>({ from: todayJst() });
  const [page, setPage] = useState(1);
  const [report, setReport] = useState({ from: monthStart(), to: todayJst() });
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<unknown>(null);
  const query = useAppointments({ ...applied, page, pageSize: 50 });
  const set = (patch: Partial<AppointmentListQuery>) =>
    setFilters((current) => ({ ...current, ...patch }));

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadReport(report.from, report.to);
    } catch (error) {
      setDownloadError(error);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <FormField label="訪問日（から）">
            {(c) => (
              <TextInput
                {...c}
                type="date"
                value={filters.from ?? ''}
                onChange={(e) => set({ from: e.target.value || undefined })}
              />
            )}
          </FormField>
          <FormField label="訪問日（まで）">
            {(c) => (
              <TextInput
                {...c}
                type="date"
                value={filters.to ?? ''}
                onChange={(e) => set({ to: e.target.value || undefined })}
              />
            )}
          </FormField>
          <FormField label="担当営業">
            {(c) => (
              <Select
                {...c}
                value={filters.salesRepId ?? ''}
                placeholder={ja.common.all}
                options={(reps.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                onChange={(e) => set({ salesRepId: e.target.value || undefined })}
              />
            )}
          </FormField>
          <FormField label="アポ取得者">
            {(c) => (
              <Select
                {...c}
                value={filters.bookedById ?? ''}
                placeholder={ja.common.all}
                options={(telemas.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                onChange={(e) => set({ bookedById: e.target.value || undefined })}
              />
            )}
          </FormField>
          <FormField label="状態">
            {(c) => (
              <Select
                {...c}
                value={filters.status ?? ''}
                placeholder={ja.common.all}
                options={Object.entries(ja.appointmentStatus).map(([value, label]) => ({
                  value,
                  label,
                }))}
                onChange={(e) =>
                  set({ status: (e.target.value || undefined) as AppointmentStatus | undefined })
                }
              />
            )}
          </FormField>
          <FormField label="会社名・担当者">
            {(c) => (
              <TextInput
                {...c}
                value={filters.q ?? ''}
                onChange={(e) => set({ q: e.target.value || undefined })}
                onKeyDown={(e) => e.key === 'Enter' && (setApplied(filters), setPage(1))}
              />
            )}
          </FormField>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            icon={<Search className="size-4" aria-hidden="true" />}
            onClick={() => {
              setApplied(filters);
              setPage(1);
            }}
          >
            検索
          </Button>
        </div>
      </Card>

      <Card flush>
        <QueryState query={query}>
          {(data) =>
            data.items.length === 0 ? (
              <EmptyState mood="think">条件に合うアポはありません。</EmptyState>
            ) : (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>訪問日時</Th>
                      <Th>会社名</Th>
                      <Th>担当営業</Th>
                      <Th className="max-md:hidden">アポ取得</Th>
                      <Th className="max-lg:hidden">取引区分</Th>
                      <Th>状態</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id} className="hover:bg-canvas">
                        <Td className="whitespace-nowrap">
                          {formatRange(item.startsAt, item.endsAt)}
                        </Td>
                        <Td>
                          <Link
                            to={paths.appointment(item.id)}
                            className="font-bold text-link hover:underline"
                          >
                            {item.company.name}
                          </Link>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <FormatBadge format={item.format} />
                            {item.isNewAppointment && (
                              <span className="text-xs text-ink-sub">新規●</span>
                            )}
                          </div>
                        </Td>
                        <Td className="whitespace-nowrap">{item.salesRep.name}</Td>
                        <Td className="whitespace-nowrap max-md:hidden">
                          {item.bookedBy.name}
                          <div className="text-xs text-ink-sub">
                            {formatDate(jstDate(new Date(item.bookedAt)))}
                          </div>
                        </Td>
                        <Td className="max-lg:hidden">
                          {customerTypes.labelOf(item.customerType)}
                        </Td>
                        <Td>
                          <div className="flex flex-col items-start gap-1.5">
                            <AppointmentStatusBadge status={item.status} />
                            {item.status === 'SCHEDULED' && (
                              <ConfirmedBadge confirmedAt={item.salesConfirmedAt} />
                            )}
                            {item.openChangeRequest && (
                              <ChangeRequestBadge status={item.openChangeRequest} />
                            )}
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <Pagination
                  page={data.page}
                  pageSize={data.pageSize}
                  total={data.total}
                  onChange={setPage}
                />
              </>
            )
          }
        </QueryState>
      </Card>

      <Card title="報告用Excel（営業訪問表）のダウンロード">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="アポ取得日（から）">
            {(c) => (
              <TextInput
                {...c}
                type="date"
                value={report.from}
                onChange={(e) => setReport({ ...report, from: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="アポ取得日（まで）">
            {(c) => (
              <TextInput
                {...c}
                type="date"
                value={report.to}
                onChange={(e) => setReport({ ...report, to: e.target.value })}
              />
            )}
          </FormField>
          <Button
            icon={<Download className="size-4" aria-hidden="true" />}
            loading={downloading}
            disabled={!report.from || !report.to}
            onClick={() => void download()}
          >
            Excelをダウンロード
          </Button>
        </div>
        <p className="mt-2 text-xs text-ink-sub">
          一覧の上に、訪問／WEBの件数・新規の件数・リスト名ごとの件数が入ります。取り消したアポは含みません。
        </p>
        {downloadError ? (
          <Alert tone="error" className="mt-3">
            {errorMessageOf(downloadError)}
          </Alert>
        ) : null}
      </Card>
    </div>
  );
}
