import {
  cleanListRow,
  CompanyFlag,
  type EditableListField,
  isUnknownPhone,
  type ListImportPreview,
  type ListImportProblemRow,
  type ListRowProblem,
  validateListRow,
} from '@telesales/shared';
import { CheckCircle2, ChevronRight, Download, FileSpreadsheet } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { Table, Td, Th } from '@/components/ui/Table';
import { TextInput } from '@/components/ui/TextInput';
import { FlagBadge } from './CallBadges';

/** What each list column is saved as (the file's own header is shown next to it). */
const FIELD_LABEL: Record<string, string> = {
  name: '会社名',
  phone: '電話番号',
  url: 'URL',
  sourceUrl: '掲載元のURL',
  office: '事業所',
  department: '部署',
  address: '住所',
  address2: '住所（続き）',
  prefecture: '都道府県',
  city: '市区町村',
  nearestStation: '最寄駅',
  industry: '業種',
  customerType: '取引区分',
  clientNo: 'クライアントNo',
  companyRank: '企業ランク',
  parentName: '親会社名',
};

const EDIT_COLUMNS: { field: EditableListField; label: string; inputMode?: 'tel' | 'url' }[] = [
  { field: 'name', label: '会社名' },
  { field: 'phone', label: '電話番号', inputMode: 'tel' },
  { field: 'url', label: 'URL（不明なら -）', inputMode: 'url' },
];

export type RowEdits = Record<number, Record<EditableListField, string>>;

export interface CheckedRow {
  source: ListImportProblemRow;
  values: Record<EditableListField, string>;
  problems: ListRowProblem[];
  /** The phone was cleared or set to 「不明」: it will be left out like the other phoneless rows. */
  noPhone: boolean;
}

/** Re-checks a problem row with the person's corrections, exactly as the server will. */
export function checkRows(preview: ListImportPreview, edits: RowEdits): CheckedRow[] {
  return preview.problems.map((source) => {
    const values = edits[source.row] ?? source.values;
    const cleaned = cleanListRow(values).values;
    return {
      source,
      values,
      problems: validateListRow(cleaned),
      noPhone: isUnknownPhone(cleaned.phone),
    };
  });
}

/** Rows still wrong, as CSV with the file's own headers, to fix in Excel and import again. */
export function downloadProblemCsv(preview: ListImportPreview, rows: CheckedRow[]) {
  const headerOf = new Map(preview.columns.map((column) => [column.field, column.header]));
  // 「住所3」 is only known as 企業ランク from the note under it, which the CSV does not keep.
  const headers = preview.headers.map((header) =>
    preview.columns.find((column) => column.header === header)?.field === 'companyRank'
      ? '企業ランク'
      : header,
  );
  const quote = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const lines = [
    [...headers, 'エラー内容'],
    ...rows.map((row) => {
      const values = { ...row.source.raw };
      for (const { field } of EDIT_COLUMNS) {
        const header = headerOf.get(field);
        if (header) values[header] = row.values[field];
      }
      return [
        ...preview.headers.map((header) => values[header] ?? ''),
        row.problems.map((problem) => problem.message).join('／'),
      ];
    }),
  ];
  const csv = `﻿${lines.map((line) => line.map(quote).join(',')).join('\r\n')}\r\n`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `${preview.fileName.replace(/\.(xlsx|csv|txt)$/i, '')}_直す行.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function Tile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number;
  note?: ReactNode;
  tone: 'success' | 'danger' | 'neutral' | 'info';
}) {
  return (
    <div
      className={cn(
        'border border-l-4 border-line bg-surface px-4 py-3',
        tone === 'success' && 'border-l-success',
        tone === 'danger' && 'border-l-danger',
        tone === 'neutral' && 'border-l-line-strong',
        tone === 'info' && 'border-l-schedule',
      )}
    >
      <div className="text-xs font-bold text-ink-sub">{label}</div>
      <div
        className={cn(
          'mt-0.5 text-2xl font-bold tabular-nums',
          tone === 'danger' && value > 0 && 'text-danger',
        )}
      >
        {value}
        <span className="ml-0.5 text-sm font-normal text-ink-sub">件</span>
      </div>
      {note && <div className="mt-0.5 text-xs text-ink-sub">{note}</div>}
    </div>
  );
}

function Disclosure({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <details className="group border border-line bg-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-sm font-bold select-none hover:bg-canvas">
        <ChevronRight
          className="size-4 text-ink-sub transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
        {title}
      </summary>
      <div className="border-t border-line px-4 py-3">{children}</div>
    </details>
  );
}

/**
 * Step 2 of the import (Sano 10/28 ②, replacing listcheck): what can come in, what was fixed
 * automatically, what was left out, and the rows to correct here or export as CSV.
 */
export function ImportReview({
  preview,
  rows,
  edits,
  onEdit,
}: {
  preview: ListImportPreview;
  rows: CheckedRow[];
  edits: RowEdits;
  onEdit: (row: number, values: Record<EditableListField, string>) => void;
}) {
  const fixedNow = rows.filter((row) => row.problems.length === 0 && !row.noPhone).length;
  const remaining = rows.filter((row) => row.problems.length > 0 && !row.noPhone);
  const leftOut = preview.avoided.length + preview.noPhoneCount;
  const fixedRows = new Set(preview.fixSamples.map((fix) => fix.row)).size;

  return (
    <>
      <Card
        title={
          <span className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-success" aria-hidden="true" />
            2. 読み込んだ内容を確かめる
          </span>
        }
      >
        <p className="mb-3 text-sm text-ink-sub">
          <span data-no-translate>{preview.fileName}</span>
          {`：${preview.rowCount}行を最後の行まで確かめました。`}
          {preview.headerRow > 1 &&
            `見出しは${preview.headerRow}行目にありました（上の行は説明として読み飛ばしました）。`}
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile
            label="取り込める"
            value={preview.validCount + fixedNow}
            tone="success"
            note={fixedNow > 0 ? `うち この画面で直した ${fixedNow}件` : undefined}
          />
          <Tile
            label="直す必要がある"
            value={remaining.length}
            tone="danger"
            note={remaining.length > 0 ? '下で直せます' : 'ありません'}
          />
          <Tile
            label="除外"
            value={leftOut}
            tone="neutral"
            note={`回避企業 ${preview.avoided.length}・電話番号なし ${preview.noPhoneCount}`}
          />
          <Tile
            label="自動で直した"
            value={preview.fixedCount}
            tone="info"
            note="株式会社の表記・全角→半角など"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge tone="outline">{`重複（電話番号が同じ）${preview.duplicateCount}件`}</Badge>
          <Badge tone="outline">{`要確認（会社名が同じ）${preview.checkCount}件`}</Badge>
          <Badge tone="outline">{`「s」京都・滋賀・奈良 ${preview.sAreaCount}件`}</Badge>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {leftOut > 0 && (
            <Disclosure title={`除外した行（${leftOut}件）`}>
              {preview.avoided.length > 0 && (
                <>
                  <p className="mb-2 text-sm">回避企業の電話番号なので取り込みません。</p>
                  <ul className="mb-3 flex flex-col gap-1 text-sm">
                    {preview.avoided.map((row) => (
                      <li key={row.row} className="flex flex-wrap gap-x-3">
                        <span className="w-16 whitespace-nowrap text-ink-sub tabular-nums">{`${row.row}行目`}</span>
                        <span data-no-translate>{row.name}</span>
                        <span className="text-ink-sub tabular-nums">{row.phone}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {preview.noPhoneCount > 0 && (
                <p className="text-sm">
                  {`電話番号が空か「不明」の行 ${preview.noPhoneCount}件も取り込みません。`}
                </p>
              )}
            </Disclosure>
          )}
          {preview.fixedCount > 0 && (
            <Disclosure title={`自動で直した箇所（${preview.fixedCount}行）`}>
              <ul className="flex flex-col gap-1.5 text-sm">
                {preview.fixSamples.map((fix) => (
                  <li
                    key={`${fix.row}:${fix.field}`}
                    className="grid grid-cols-[4rem_6rem_1fr] items-baseline gap-2"
                  >
                    <span className="whitespace-nowrap text-ink-sub tabular-nums">{`${fix.row}行目`}</span>
                    <span className="text-ink-sub">{FIELD_LABEL[fix.field] ?? fix.field}</span>
                    <span className="min-w-0 break-all" data-no-translate>
                      <span className="text-ink-sub line-through">{fix.before}</span>
                      <span className="mx-1.5 text-ink-sub">→</span>
                      {fix.after}
                    </span>
                  </li>
                ))}
              </ul>
              {preview.fixedCount > fixedRows && (
                <p className="mt-2 text-xs text-ink-sub">
                  {`ほか ${preview.fixedCount - fixedRows}行も同じように直しました。`}
                </p>
              )}
            </Disclosure>
          )}
          <Disclosure title="列の対応">
            <div className="flex flex-wrap gap-2">
              {preview.columns.map((column) => (
                <span
                  key={column.header}
                  className={cn(
                    'border px-2.5 py-1 text-xs',
                    column.field ? 'border-line-strong' : 'border-line text-ink-sub',
                  )}
                >
                  <span data-no-translate>{column.header}</span>
                  <span className="mx-1 text-ink-sub">→</span>
                  {column.field ? (FIELD_LABEL[column.field] ?? column.field) : 'その他の項目'}
                </span>
              ))}
            </div>
          </Disclosure>
        </div>
      </Card>

      {rows.length > 0 && (
        <Card
          title={`直す必要がある行（${rows.length}件）`}
          actions={
            <Button
              size="sm"
              variant="secondary"
              icon={<Download className="size-4" aria-hidden="true" />}
              disabled={remaining.length === 0}
              onClick={() => downloadProblemCsv(preview, remaining)}
            >
              {`直せない行をCSVで出す（${remaining.length}件）`}
            </Button>
          }
        >
          <p className="mb-4 text-sm text-ink-sub">
            ここで直した行は一緒に取り込みます。ここで直せない行はCSVで出し、Excelで直してから取り込み直してください。
          </p>
          <div
            role="row"
            className="hidden border-b border-line pb-2 text-xs font-bold text-ink-sub md:grid md:grid-cols-[4.5rem_minmax(0,1.2fr)_10rem_minmax(0,1.3fr)_10rem] md:gap-3"
          >
            <span>行</span>
            {EDIT_COLUMNS.map((column) => (
              <span key={column.field}>{column.label}</span>
            ))}
            <span>状態</span>
          </div>
          <ul className="scroll-quiet divide-y divide-line md:max-h-[32rem] md:overflow-y-auto">
            {rows.map((row) => {
              const ok = row.problems.length === 0 && !row.noPhone;
              const bad = new Set(row.problems.map((problem) => problem.field));
              return (
                <li
                  key={row.source.row}
                  className={cn(
                    'grid gap-2 py-3 md:grid-cols-[4.5rem_minmax(0,1.2fr)_10rem_minmax(0,1.3fr)_10rem] md:items-start md:gap-3',
                    ok && 'bg-success-soft/40',
                  )}
                >
                  <span className="pt-2 text-sm font-bold tabular-nums">{`${row.source.row}行目`}</span>
                  {EDIT_COLUMNS.map((column) => (
                    <label key={column.field} className="flex flex-col gap-1">
                      <span className="text-xs text-ink-sub md:sr-only">{column.label}</span>
                      <TextInput
                        className="h-9 text-sm"
                        inputMode={column.inputMode}
                        value={row.values[column.field]}
                        aria-invalid={bad.has(column.field)}
                        onChange={(event) =>
                          onEdit(row.source.row, {
                            ...(edits[row.source.row] ?? row.source.values),
                            [column.field]: event.target.value,
                          })
                        }
                      />
                    </label>
                  ))}
                  <div className="pt-1.5 text-xs">
                    {ok ? (
                      <span className="inline-flex items-center gap-1 font-bold text-success">
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                        直りました
                      </span>
                    ) : row.noPhone ? (
                      <span className="text-ink-sub">電話番号なしとして除外します</span>
                    ) : (
                      <ul className="flex flex-col gap-0.5 text-danger">
                        {row.problems.map((problem) => (
                          <li key={problem.message}>{problem.message}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {preview.sample.length > 0 && (
        <Card title={`取り込む行（先頭の${preview.sample.length}行）`} flush>
          <Table>
            <thead>
              <tr>
                <Th>行</Th>
                <Th>会社名</Th>
                <Th>電話番号</Th>
                <Th className="max-md:hidden">URL</Th>
                <Th>印</Th>
              </tr>
            </thead>
            <tbody>
              {preview.sample.map((row) => (
                <tr key={row.row}>
                  <Td className="tabular-nums">{row.row}</Td>
                  <Td data-no-translate>{row.name}</Td>
                  <Td className="whitespace-nowrap tabular-nums">{row.phone}</Td>
                  <Td className="break-all max-md:hidden">{row.url}</Td>
                  <Td>
                    <FlagBadge flag={row.flag} />
                    {row.flag !== CompanyFlag.None && row.matchedName && (
                      <div className="mt-1 text-xs text-ink-sub" data-no-translate>
                        {row.matchedName}
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
