import {
  datedListName,
  jstDate,
  type ListImportPreview,
  ListImportPurpose,
} from '@telesales/shared';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { MoraBot, MoraBotProgress } from '@/components/brand/MoraBot';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { FileDrop } from '@/components/ui/FileDrop';
import { FormField } from '@/components/ui/FormField';
import { TextInput } from '@/components/ui/TextInput';
import { ApiError } from '@/lib/api/ApiError';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { ja } from '@/i18n/ja';
import { useCommitImport, usePreviewImport } from './api';
import { checkRows, ImportReview, type RowEdits } from './ImportReview';

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
  const [autoAllocate, setAutoAllocate] = useState(true);
  const [edits, setEdits] = useState<RowEdits>({});
  const checked = useMemo(() => (result ? checkRows(result, edits) : []), [result, edits]);
  const fixes = checked
    .filter((row) => edits[row.source.row] && row.problems.length === 0 && !row.noPhone)
    .map((row) => ({ row: row.source.row, ...row.values }));
  const importCount = (result?.validCount ?? 0) + fixes.length;
  const savedName = datedListName(listName || 'リスト名', jstDate(new Date()));

  const onFiles = (files: File[]) => {
    const [file] = files;
    if (!file) return;
    commit.reset();
    preview.mutate(file, {
      onSuccess: (data) => {
        setResult(data);
        setEdits({});
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
            取り込まなかった行 {done.errorCount}件
          </p>
          {done.avoidedCount + done.noPhoneCount > 0 && (
            <p className="text-sm text-ink-sub">
              {`除外：回避企業 ${done.avoidedCount}件・電話番号なし ${done.noPhoneCount}件`}
            </p>
          )}
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
          hint="Excel（.xlsx）または CSV。必須の列は 会社名・電話番号・URL の3つです。テレマのリスト様式（2行目が見出し）もそのまま読めます。"
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
          <ImportReview
            preview={result}
            rows={checked}
            edits={edits}
            onEdit={(row, values) => setEdits((current) => ({ ...current, [row]: values }))}
          />

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
              {purpose === ListImportPurpose.CallRequest && (
                <fieldset className="flex flex-col">
                  <legend className="mb-1 text-sm font-bold">割り振り</legend>
                  <Checkbox
                    type="radio"
                    name="autoAllocate"
                    label="自動割り振りする（毎朝の自動割り振りでテレマに配ります）"
                    checked={autoAllocate}
                    onChange={() => setAutoAllocate(true)}
                  />
                  <Checkbox
                    type="radio"
                    name="autoAllocate"
                    label="自動割り振りしない（架電対象にはなり、リーダーが手で割り振ります）"
                    checked={!autoAllocate}
                    onChange={() => setAutoAllocate(false)}
                  />
                </fieldset>
              )}
              <FormField
                label="リスト名"
                required
                hint={`保存名：${savedName}（取り込み日が前に付きます）`}
              >
                {(c) => (
                  <TextInput
                    {...c}
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    maxLength={180}
                  />
                )}
              </FormField>
              {commit.isError && <Alert tone="error">{importErrorMessage(commit.error)}</Alert>}
              <div className="flex justify-end">
                <Button
                  size="lg"
                  loading={commit.isPending}
                  disabled={!listName.trim() || importCount === 0}
                  onClick={() =>
                    commit.mutate({
                      fileId: result.fileId,
                      purpose,
                      listName: listName.trim(),
                      autoAllocate,
                      fixes,
                    })
                  }
                >
                  {importCount}件を取り込む
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
