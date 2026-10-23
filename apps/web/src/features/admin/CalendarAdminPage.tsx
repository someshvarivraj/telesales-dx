import { HolidayKind } from '@telesales/shared';
import { Download, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { DatePicker } from '@/components/ui/DatePicker';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { QueryState } from '@/components/ui/QueryState';
import { Select } from '@/components/ui/Select';
import { Table, Td, Th } from '@/components/ui/Table';
import { TextInput } from '@/components/ui/TextInput';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDate, todayJst } from '@/lib/format';
import {
  useAddCompanyHoliday,
  useAdminCalendar,
  useImportHolidays,
  useRemoveCompanyHoliday,
} from './api';

/** Public holidays (imported yearly) and company holidays (entered by admins) — spec §9-4. */
export function CalendarAdminPage() {
  const thisYear = Number(todayJst().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const days = useAdminCalendar(year);
  const importHolidays = useImportHolidays();
  const add = useAddCompanyHoliday();
  const remove = useRemoveCompanyHoliday();
  const [holiday, setHoliday] = useState({ date: '', name: '' });
  const fileInput = useRef<HTMLInputElement>(null);
  const error = importHolidays.error ?? add.error ?? remove.error;

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert tone="error">{errorMessageOf(error)}</Alert>}
      {importHolidays.isSuccess && (
        <Alert tone="success">
          {year}年の祝日を{importHolidays.data.imported}件取り込みました。
        </Alert>
      )}
      <Card title="祝日の取り込み">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="年">
            {(c) => (
              <Select
                {...c}
                value={String(year)}
                options={[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map((y) => ({
                  value: String(y),
                  label: `${y}年`,
                }))}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            )}
          </FormField>
          <Button
            icon={<Download className="size-4" aria-hidden="true" />}
            loading={importHolidays.isPending}
            onClick={() => importHolidays.mutate({ year })}
          >
            内閣府の祝日を取り込む
          </Button>
          <Button variant="secondary" onClick={() => fileInput.current?.click()}>
            CSVファイルから取り込む
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importHolidays.mutate({ year, file });
              e.target.value = '';
            }}
          />
        </div>
        <p className="mt-2 text-xs text-ink-sub">
          内閣府「国民の祝日」CSVを使います。ネットにつながらないときは、そのCSVをダウンロードして選んでください。会社の休日はそのまま残ります。
        </p>
      </Card>
      <Card title="会社の休日を追加">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="日付">
            {(c) => (
              <DatePicker
                {...c}
                value={holiday.date}
                onChange={(e) => setHoliday({ ...holiday, date: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="名前">
            {(c) => (
              <TextInput
                {...c}
                value={holiday.name}
                placeholder="例：夏季休業"
                onChange={(e) => setHoliday({ ...holiday, name: e.target.value })}
              />
            )}
          </FormField>
          <Button
            loading={add.isPending}
            disabled={!holiday.date || !holiday.name.trim()}
            onClick={() =>
              add.mutate(
                { date: holiday.date, name: holiday.name.trim() },
                { onSuccess: () => setHoliday({ date: '', name: '' }) },
              )
            }
          >
            追加
          </Button>
        </div>
      </Card>
      <Card title={`${year}年の休日`} flush>
        <QueryState query={days}>
          {(items) =>
            items.length === 0 ? (
              <EmptyState>まだ休日が入っていません。祝日を取り込んでください。</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>日付</Th>
                    <Th>名前</Th>
                    <Th>種類</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((day) => (
                    <tr key={day.date}>
                      <Td className="whitespace-nowrap">{formatDate(day.date)}</Td>
                      <Td>{day.name}</Td>
                      <Td>
                        {day.kind === HolidayKind.PublicHoliday ? (
                          <Badge tone="danger">祝日</Badge>
                        ) : (
                          <Badge tone="calls">会社の休日</Badge>
                        )}
                      </Td>
                      <Td>
                        {day.kind === HolidayKind.CompanyHoliday && (
                          <Button
                            variant="text"
                            aria-label={`${day.name}を削除`}
                            icon={<Trash2 className="size-4" aria-hidden="true" />}
                            onClick={() => remove.mutate(day.date)}
                          />
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )
          }
        </QueryState>
      </Card>
    </div>
  );
}
