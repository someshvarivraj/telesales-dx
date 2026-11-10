import {
  type BulkEditDto,
  type BulkEditField,
  type BulkEditRequest,
  formatCapital,
  INDUSTRIES,
  OptionCategory,
  parseCapital,
} from '@telesales/shared';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { DraftNotice, ResetButton } from '@/components/ui/DraftBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';
import { cn } from '@/components/ui/cn';
import { useOptionList } from '@/features/reference/useReference';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { useDraft } from '@/lib/drafts';
import { formatDateTime } from '@/lib/format';
import { useBulkEdit, useBulkEdits, useRestoreBulkEdit } from './api';

/**
 * The ones edited most often come first (answer 11/10 No.13: search items 3・5・10・12・13・14・16 on
 * the PDF — 業種, 企業ランク, 会社名, 郵便番号, エリア, 最寄駅, 備考).
 */
const FIELDS: { field: BulkEditField; label: string; hint?: string; often?: true }[] = [
  { field: 'industry', label: '業種', often: true },
  { field: 'companyRank', label: '企業ランク', often: true },
  { field: 'name', label: '会社名', hint: '前の名前は旧社名として残ります', often: true },
  { field: 'postalCode', label: '郵便番号', often: true },
  {
    field: 'address',
    label: '住所',
    hint: '都道府県・市区町村は住所から読み直します',
    often: true,
  },
  { field: 'prefecture', label: '都道府県', often: true },
  { field: 'city', label: '市区町村', often: true },
  { field: 'nearestStation', label: '最寄駅', often: true },
  {
    field: 'telemaMemo',
    label: '備考（テレマメモ）',
    hint: '今のメモはこの内容に置き換わります',
    often: true,
  },
  { field: 'office', label: '事業所' },
  { field: 'department', label: '部署' },
  { field: 'phone', label: '電話番号' },
  { field: 'url', label: 'URL' },
  { field: 'sourceUrl', label: '掲載元のURL' },
  { field: 'walkMinutes', label: '徒歩（分）' },
  { field: 'capital', label: '資本金', hint: '「5000万」「1億2000万」でも入力できます' },
  { field: 'customerType', label: '取引区分' },
  { field: 'clientNo', label: 'クライアントNo' },
  { field: 'parentName', label: '親会社名' },
];

interface BulkDraft {
  ticked: BulkEditField[];
  values: Partial<Record<BulkEditField, string>>;
}

const EMPTY: BulkDraft = { ticked: [], values: {} };

function walkOf(text: string): number | null | undefined {
  if (!text.trim()) return null;
  const minutes = Number(text.normalize('NFKC'));
  return Number.isInteger(minutes) && minutes >= 0 && minutes <= 240 ? minutes : undefined;
}

/**
 * 一括修正 (Sano 11/2): tick the items to change and write the new value; an item left empty is
 * emptied. Every company's previous values are kept, so it can be undone from 一括修正の履歴.
 */
export function BulkEditDialog({
  open,
  companyIds,
  onClose,
  onDone,
}: {
  open: boolean;
  companyIds: string[];
  onClose: () => void;
  onDone: (edit: BulkEditDto) => void;
}) {
  const edit = useBulkEdit();
  const ranks = useOptionList(OptionCategory.CompanyRank);
  const customerTypes = useOptionList(OptionCategory.CustomerType);
  // Kept through a refresh until saved (request 11/2).
  const draft = useDraft<BulkDraft>('company-bulk-edit', EMPTY);
  const { ticked, values } = draft.value;
  const tick = (field: BulkEditField, on: boolean) =>
    draft.set((current) => ({
      ...current,
      ticked: on ? [...current.ticked, field] : current.ticked.filter((f) => f !== field),
    }));
  const write = (field: BulkEditField, value: string) =>
    draft.set((current) => ({
      ticked: current.ticked.includes(field) ? current.ticked : [...current.ticked, field],
      values: { ...current.values, [field]: value },
    }));
  const text = (field: BulkEditField) => values[field] ?? '';

  const capital = parseCapital(text('capital'));
  const capitalBad =
    ticked.includes('capital') && text('capital').trim() !== '' && capital === null;
  const walk = walkOf(text('walkMinutes'));
  const walkBad = ticked.includes('walkMinutes') && walk === undefined;
  const nameBad = ticked.includes('name') && !text('name').trim();
  const samePhone = ticked.includes('phone') && !!text('phone').trim() && companyIds.length > 1;

  const submit = () => {
    const changes: Record<string, unknown> = {};
    for (const field of ticked) {
      if (field === 'capital') changes.capital = capital;
      else if (field === 'walkMinutes') changes.walkMinutes = walk;
      else changes[field] = text(field);
    }
    edit.mutate(
      { companyIds, changes: changes as BulkEditRequest['changes'] },
      {
        onSuccess: (result) => {
          draft.reset();
          onDone(result);
        },
      },
    );
  };

  const input = (field: BulkEditField, label: string) => {
    const on = ticked.includes(field);
    if (field === 'industry' || field === 'companyRank' || field === 'customerType') {
      const options =
        field === 'industry'
          ? INDUSTRIES.map((value) => ({ value, label: value }))
          : field === 'companyRank'
            ? ranks.selectOptions
            : customerTypes.selectOptions;
      return (
        <Select
          size="sm"
          aria-label={label}
          disabled={!on}
          value={text(field)}
          placeholder="空にする"
          options={options}
          onChange={(event) => write(field, event.target.value)}
        />
      );
    }
    const bad =
      (field === 'capital' && capitalBad) ||
      (field === 'walkMinutes' && walkBad) ||
      (field === 'name' && nameBad);
    return (
      <TextInput
        aria-label={label}
        aria-invalid={bad}
        disabled={!on}
        className="h-9 text-sm"
        placeholder={on && field !== 'name' ? '空のままなら空にします' : undefined}
        value={text(field)}
        onChange={(event) => write(field, event.target.value)}
      />
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={`${companyIds.length}社を一括修正`}
      footer={
        <>
          <ResetButton dirty={draft.dirty} onReset={draft.reset} className="mr-auto" />
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            onClick={submit}
            loading={edit.isPending}
            disabled={ticked.length === 0 || capitalBad || walkBad || nameBad}
          >
            {`${ticked.length}項目を${companyIds.length}社に反映する`}
          </Button>
        </>
      }
    >
      <DraftNotice restoredAt={draft.restoredAt} onReset={draft.reset} className="mb-4" />
      <div className="flex flex-col gap-3">
        {edit.isError && <Alert tone="error">{errorMessageOf(edit.error)}</Alert>}
        <p className="text-sm text-ink-sub">
          変える項目にチェックを入れてください。チェックしていない項目は変わりません。あとで「一括修正の履歴」から元に戻せます。
        </p>
        {samePhone && (
          <Alert tone="warning">
            {`同じ電話番号が${companyIds.length}社に入ります。重複の確認にも影響します。よければそのまま進めてください。`}
          </Alert>
        )}
        {[
          { title: 'よく直す項目', fields: FIELDS.filter((f) => f.often) },
          { title: 'そのほかの項目', fields: FIELDS.filter((f) => !f.often) },
        ].map((group) => (
          <section key={group.title} className="flex flex-col gap-1.5">
            <h3 className="text-xs font-bold text-ink-sub">{group.title}</h3>
            <ul className="divide-y divide-line border border-line">
              {group.fields.map(({ field, label, hint }) => {
                const on = ticked.includes(field);
                const shown =
                  field === 'capital' && capital !== null ? `＝ ${formatCapital(capital)}` : hint;
                return (
                  <li
                    key={field}
                    className={cn(
                      'grid grid-cols-[minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-3 py-2 sm:grid-cols-[10rem_minmax(0,1fr)]',
                      on && 'bg-main-soft/50',
                    )}
                  >
                    <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        className="check-input"
                        checked={on}
                        onChange={(event) => tick(field, event.target.checked)}
                      />
                      <span className={cn(on && 'font-bold')}>{label}</span>
                    </label>
                    <div className="min-w-0">
                      {input(field, label)}
                      {on && shown && <p className="mt-1 text-xs text-ink-sub">{shown}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}

const LABEL_OF = Object.fromEntries(FIELDS.map(({ field, label }) => [field, label])) as Record<
  BulkEditField,
  string
>;

/** What one 一括修正 changed and on which companies; each one can be undone once. */
export function BulkEditHistoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const edits = useBulkEdits(open);
  const restore = useRestoreBulkEdit();
  const ranks = useOptionList(OptionCategory.CompanyRank);
  const customerTypes = useOptionList(OptionCategory.CustomerType);
  const valueOf = (field: BulkEditField, value: unknown) => {
    if (value === null || value === undefined || value === '') return '（空）';
    if (field === 'capital') return formatCapital(Number(value)) ?? String(value);
    if (field === 'companyRank') return ranks.labelOf(String(value));
    if (field === 'customerType') return customerTypes.labelOf(String(value));
    return String(value);
  };
  return (
    <Dialog open={open} onClose={onClose} size="lg" title="一括修正の履歴">
      <div className="flex flex-col gap-3">
        {restore.isError && <Alert tone="error">{errorMessageOf(restore.error)}</Alert>}
        {(edits.data ?? []).length === 0 && !edits.isLoading && (
          <EmptyState mood="think">一括修正の履歴はまだありません。</EmptyState>
        )}
        <ul className="flex flex-col gap-3">
          {(edits.data ?? []).map((edit) => (
            <li key={edit.id} className="border border-line p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-bold tabular-nums">
                  {formatDateTime(edit.createdAt)}
                </span>
                <span className="text-sm text-ink-sub" data-no-translate="">
                  {edit.actor?.name}
                </span>
                <span className="text-sm">{`${edit.companyCount}社`}</span>
                {edit.restoredAt ? (
                  <span className="ml-auto text-xs font-bold text-ink-sub">
                    {`${formatDateTime(edit.restoredAt)} に元に戻しました`}
                    {edit.skippedCount > 0 &&
                      `（そのあと変更された${edit.skippedCount}社はそのままです）`}
                  </span>
                ) : (
                  <Button
                    className="ml-auto"
                    size="sm"
                    variant="secondary"
                    loading={restore.isPending && restore.variables === edit.id}
                    onClick={() => restore.mutate(edit.id)}
                  >
                    元に戻す
                  </Button>
                )}
              </div>
              <dl className="mt-2 grid gap-x-4 gap-y-0.5 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
                {Object.entries(edit.changes).map(([field, value]) => (
                  <div key={field} className="contents">
                    <dt className="text-ink-sub">{LABEL_OF[field as BulkEditField] ?? field}</dt>
                    <dd className="font-bold break-words" data-no-translate="">
                      {valueOf(field as BulkEditField, value)}
                    </dd>
                  </div>
                ))}
              </dl>
              <details className="mt-2 text-xs text-ink-sub">
                <summary className="cursor-pointer">修正した企業を見る</summary>
                <p className="mt-1 leading-relaxed" data-no-translate="">
                  {edit.companies.map((company) => company.name).join('、')}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
