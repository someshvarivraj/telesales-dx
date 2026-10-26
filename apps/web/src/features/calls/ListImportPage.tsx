import { CompanyFlag, type ListImportPreview, ListImportPurpose } from '@telesales/shared';
import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { MoraBot, MoraBotProgress } from '@/components/brand/MoraBot';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { FileDrop } from '@/components/ui/FileDrop';
import { FormField } from '@/components/ui/FormField';
import { Table, Td, Th } from '@/components/ui/Table';
import { TextInput } from '@/components/ui/TextInput';
import { ApiError } from '@/lib/api/ApiError';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { ja } from '@/i18n/ja';
import { useCommitImport, usePreviewImport } from './api';
import { FlagBadge } from './CallBadges';

const UNREADABLE: Record<string, string> = {
  unsupported_type: 'Excel（.xlsx）か CSV を選んでください。',
  broken_file: 'Excelファイルが壊れているか、パスワードが付いています。',
  broken_csv: 'CSVの形式が正しくありません。',
  empty: 'データが入っていません。',
  no_valid_rows: '登録できる行がありません。',
};

function importErrorMessage(error: unknown): string {
  if (ApiError.isApiError(error)) {
    const details = error.details as
      { reason?: string; columns?: string[]; listName?: string } | undefined;
    if (error.code === 'FILE_UNREADABLE' && details?.reason === 'missing_columns') {
      return `必須の列がありません：${details.columns?.join('、')}（見出しの名前で探しています）`;
    }
    if (error.code === 'FILE_UNREADABLE' && details?.reason) {
      return UNREADABLE[details.reason] ?? errorMessageOf(error);
    }
    if (error.code === 'DUPLICATE_FILE') {
      return `このファイルは「${details?.listName ?? ''}」としてすでに取り込まれています。`;
    }
  }
  return errorMessageOf(error);
}

/**
 * New list import (spec §9-1): read the file, show what was read (row errors,
 * duplicates), then choose the purpose and register.
 */
export function ListImportPage() {
  const preview = usePreviewImport();
  const commit = useCommitImport();
  const [result, setResult] = useState<ListImportPreview | null>(null);
  const [purpose, setPurpose] = useState<ListImportPurpose>(ListImportPurpose.CallRequest);
  const [listName, setListName] = useState('');

  const onFiles = (files: File[]) => {
    const [file] = files;
    if (!file) return;
    commit.reset();
    preview.mutate(file, {
      onSuccess: (data) => {
        setResult(data);
        setListName(data.fileName.replace(/\.(xlsx|csv|txt)$/i, ''));
      },
    });
  };

  if (commit.isSuccess) {
    const done = commit.data;
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <MoraBot mood="done" size={128} title="" />
          <p className="text-lg font-bold">「{done.listName}」を取り込みました。</p>
          <p className="text-sm text-ink-sub">
            登録 {done.createdCount}件（重複 {done.duplicateCount}件・要確認 {done.checkCount}件）／
            読めなかった行 {done.errorCount}件
          </p>
          {done.purpose === ListImportPurpose.CallRequest && (
            <p className="text-sm">テレマ全員にお知らせしました（N17）。</p>
          )}
          <div className="mt-2 flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                commit.reset();
                preview.reset();
                setResult(null);
              }}
            >
              続けて取り込む
            </Button>
            <Link
              to={`${paths.calls}?list=${encodeURIComponent(done.listName)}`}
              className="inline-flex h-10 items-center rounded-(--radius-control) bg-main px-4 text-sm font-bold text-white hover:bg-main-hover"
            >
              架電対象を見る
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Card title="1. ファイルを選ぶ">
        <FileDrop
          accept=".xlsx,.csv,text/csv"
          hint="Excel（.xlsx）または CSV。必須の列は 会社名・電話番号・URL の3つです。"
          onFiles={onFiles}
          disabled={preview.isPending}
        />
        {preview.isPending && (
          <div className="mt-4">
            <MoraBotProgress label="ファイルを読み込んでいます…" />
          </div>
        )}
        {preview.isError && (
          <Alert tone="error" className="mt-3">
            {importErrorMessage(preview.error)}
          </Alert>
        )}
      </Card>

      {result && (
        <>
          <Card
            title={
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="size-5 text-success" aria-hidden="true" />
                2. 読み込んだ内容を確かめる
              </span>
            }
          >
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['行数', result.rowCount],
                ['登録できる', result.validCount],
                ['重複（電話番号が同じ）', result.duplicateCount],
                ['要確認（会社名が同じ）', result.checkCount],
              ].map(([label, value]) => (
                <div key={label} className="rounded-(--radius-control) bg-canvas px-3 py-2.5">
                  <div className="text-xs text-ink-sub">{label}</div>
                  <div className="text-xl font-bold">{value}</div>
                </div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <Alert tone="warning" className="mb-4">
                <p className="mb-1 font-bold">
                  読めなかった行（{result.errors.length}件）。これらは登録されません。
                </p>
                <ul className="max-h-40 list-inside overflow-y-auto text-sm">
                  {result.errors.map((error) => (
                    <li key={`${error.row}-${error.message}`}>{error.message}</li>
                  ))}
                </ul>
              </Alert>
            )}
            <p className="mb-2 text-sm font-bold">列の対応</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {result.columns.map((column) => (
                <span
                  key={column.header}
                  className="rounded-full border border-line px-2.5 py-0.5 text-xs"
                >
                  {column.header} → {column.field ? '取り込む' : 'その他の項目として保存'}
                </span>
              ))}
            </div>
            <p className="mb-2 text-sm font-bold">先頭の{result.sample.length}行</p>
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
                {result.sample.map((row) => (
                  <tr key={row.row}>
                    <Td>{row.row}</Td>
                    <Td>{row.name}</Td>
                    <Td className="whitespace-nowrap">{row.phone}</Td>
                    <Td className="break-all max-md:hidden">{row.url}</Td>
                    <Td>
                      <FlagBadge flag={row.flag} />
                      {row.flag !== CompanyFlag.None && row.matchedName && (
                        <div className="mt-1 text-xs text-ink-sub">{row.matchedName}</div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card title="3. 目的を選んで取り込む">
            <div className="flex flex-col gap-4">
              <fieldset className="flex flex-col">
                <legend className="mb-1 text-sm font-bold">目的</legend>
                <Checkbox
                  type="radio"
                  name="purpose"
                  label={`${ja.listPurpose.CALL_REQUEST}（テレマ全員に知らせ、架電対象にします）`}
                  checked={purpose === ListImportPurpose.CallRequest}
                  onChange={() => setPurpose(ListImportPurpose.CallRequest)}
                />
                <Checkbox
                  type="radio"
                  name="purpose"
                  label={`${ja.listPurpose.REGISTER_ONLY}（知らせません）`}
                  checked={purpose === ListImportPurpose.RegisterOnly}
                  onChange={() => setPurpose(ListImportPurpose.RegisterOnly)}
                />
              </fieldset>
              <FormField label="リスト名" required>
                {(c) => (
                  <TextInput
                    {...c}
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    maxLength={200}
                  />
                )}
              </FormField>
              {commit.isError && <Alert tone="error">{importErrorMessage(commit.error)}</Alert>}
              <div className="flex justify-end">
                <Button
                  size="lg"
                  loading={commit.isPending}
                  disabled={!listName.trim() || result.validCount === 0}
                  onClick={() =>
                    commit.mutate({ fileId: result.fileId, purpose, listName: listName.trim() })
                  }
                >
                  {result.validCount}件を取り込む
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
