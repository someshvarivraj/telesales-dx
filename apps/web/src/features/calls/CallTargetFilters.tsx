import { type CompanyFilterCondition, splitRange } from '@telesales/shared';
import { Check, ChevronLeft, Plus, Search, X } from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { cn } from '@/components/ui/cn';
import { PopoverPanel, usePopover } from '@/components/ui/Popover';
import { Segmented } from '@/components/ui/Segmented';
import { TextInput } from '@/components/ui/TextInput';

export type FilterField = Exclude<CompanyFilterCondition['field'], 'name'>;

export interface FilterChip {
  key: number;
  field: FilterField;
  value: string;
}

export interface Choice {
  value: string;
  label: string;
}

interface FieldDef {
  field: FilterField;
  label: string;
  group: '企業' | '架電' | '日付・番号';
  /** No value to enter: the condition is the field itself. */
  noValue?: boolean;
  /** Entered as 「from~to」. */
  range?: 'date' | 'number';
}

export const FILTER_FIELDS: FieldDef[] = [
  { field: 'prefecture', label: '都道府県', group: '企業' },
  { field: 'city', label: '市区町村', group: '企業' },
  { field: 'industry', label: '業種', group: '企業' },
  { field: 'companyRank', label: '企業ランク', group: '企業' },
  { field: 'customerType', label: '取引区分', group: '企業' },
  { field: 'listName', label: 'リスト名', group: '企業' },
  { field: 'flag', label: '重複・要確認', group: '企業' },
  { field: 'lastGrade', label: '最新の判定', group: '架電' },
  { field: 'telemarketer', label: 'テレマ担当者', group: '架電' },
  { field: 'nextCallDue', label: 'B次回架電日が来ている', group: '架電', noValue: true },
  { field: 'neverCalled', label: 'まだ架電していない', group: '架電', noValue: true },
  { field: 'lastCallDate', label: '最新テレマ日', group: '日付・番号', range: 'date' },
  {
    field: 'nextCallDate',
    label: 'テレマ予定日（B次回架電日）',
    group: '日付・番号',
    range: 'date',
  },
  { field: 'importedDate', label: '取込日', group: '日付・番号', range: 'date' },
  { field: 'telemaIdNo', label: 'テレマIDNo', group: '日付・番号', range: 'number' },
];
const GROUPS = ['企業', '架電', '日付・番号'] as const;

/** 「2026/10/01〜2026/10/31」, 「100〜」 … */
function rangeLabel(value: string): string {
  const { from, to } = splitRange(value);
  const show = (part: string) => part.replaceAll('-', '/');
  return `${show(from)}〜${show(to)}`;
}

export function fieldDef(field: FilterField): FieldDef {
  return FILTER_FIELDS.find((def) => def.field === field) ?? { field, label: field, group: '企業' };
}

interface CallTargetFiltersProps {
  name: string;
  onName: (name: string) => void;
  chips: FilterChip[];
  onChips: (chips: FilterChip[]) => void;
  match: 'AND' | 'OR';
  onMatch: (match: 'AND' | 'OR') => void;
  onlyTargets: boolean;
  onOnlyTargets: (on: boolean) => void;
  onlyMine: boolean;
  onOnlyMine: (on: boolean) => void;
  /** Fixed choices for some fields (grades, 取引区分, flags); others are typed in. */
  choicesOf: (field: FilterField) => Choice[] | null;
}

/**
 * The filter bar above the call target list: a keyword search, two on/off switches,
 * and the other conditions as tags you add from a menu. Results follow as you change it.
 */
export function CallTargetFilters(props: CallTargetFiltersProps) {
  const { chips, onChips, choicesOf } = props;
  const labelOf = (chip: FilterChip) => {
    const def = fieldDef(chip.field);
    if (def.noValue) return def.label;
    const choice = choicesOf(chip.field)?.find((c) => c.value === chip.value);
    return (
      <>
        <span className="font-normal text-ink-sub">{def.label}：</span>
        {def.range ? rangeLabel(chip.value) : (choice?.label ?? chip.value)}
      </>
    );
  };
  const save = (chip: FilterChip) =>
    onChips(
      chips.some((c) => c.key === chip.key)
        ? chips.map((c) => (c.key === chip.key ? chip : c))
        : [...chips, chip],
    );

  return (
    <section aria-label="絞り込み" className="border border-line bg-surface shadow-(--shadow-card)">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <label className="relative w-full sm:w-[30rem]">
          <span className="sr-only">キーワードで探す</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-sub"
          />
          <input
            type="search"
            value={props.name}
            onChange={(e) => props.onName(e.target.value)}
            placeholder="キーワード（会社名・住所・電話番号・メモ など）"
            title="スペースで区切ると、すべての言葉を含む企業を探します"
            className="h-10 w-full border border-line-strong bg-surface pr-9 pl-9 text-sm placeholder:text-ink-disabled focus:border-main-focus focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {props.name && (
            <button
              type="button"
              aria-label="キーワードをクリア"
              onClick={() => props.onName('')}
              className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center text-ink-sub hover:text-ink"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          )}
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Toggle on={props.onlyTargets} onChange={props.onOnlyTargets}>
            架電対象だけ
          </Toggle>
          <Toggle on={props.onlyMine} onChange={props.onOnlyMine}>
            今日の自分の担当だけ
          </Toggle>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-column px-3 py-2.5">
        <span className="mr-1 text-xs font-bold text-ink-sub">条件</span>
        {chips.map((chip, index) => (
          <span key={chip.key} className="contents">
            {index > 0 && (
              <span className="text-[11px] font-bold text-ink-sub">
                {props.match === 'AND' ? 'かつ' : 'または'}
              </span>
            )}
            <ConditionEditor
              initial={chip}
              choicesOf={choicesOf}
              onSave={save}
              trigger={(open, ref) => (
                <span className="inline-flex h-8 items-stretch border border-main-line bg-surface text-sm">
                  <button
                    ref={ref}
                    type="button"
                    onClick={open}
                    className="cursor-pointer px-2.5 font-bold text-ink hover:bg-main-soft"
                  >
                    {labelOf(chip)}
                  </button>
                  <button
                    type="button"
                    aria-label="この条件を外す"
                    onClick={() => onChips(chips.filter((c) => c.key !== chip.key))}
                    className="grid w-7 cursor-pointer place-items-center border-l border-main-line text-ink-sub hover:bg-main-soft hover:text-ink"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </span>
              )}
            />
          </span>
        ))}
        {chips.length < 9 && (
          <ConditionEditor
            choicesOf={choicesOf}
            onSave={save}
            trigger={(open, ref) => (
              <button
                ref={ref}
                type="button"
                onClick={open}
                className="inline-flex h-8 cursor-pointer items-center gap-1 border border-dashed border-line-strong bg-surface px-2.5 text-sm font-bold text-ink-sub hover:border-main hover:text-main"
              >
                <Plus aria-hidden="true" className="size-4" />
                条件を追加
              </button>
            )}
          />
        )}
        {chips.length === 0 && (
          <span className="text-xs text-ink-sub">エリア・業種・判定などで絞り込めます</span>
        )}
        {chips.length >= 2 && (
          <Segmented
            size="sm"
            aria-label="条件のつなぎ方"
            value={props.match}
            onChange={props.onMatch}
            options={[
              { value: 'AND', label: 'すべて満たす' },
              { value: 'OR', label: 'どれかを満たす' },
            ]}
            className="ml-1"
          />
        )}
        {chips.length > 0 && (
          <button
            type="button"
            onClick={() => onChips([])}
            className="ml-auto cursor-pointer text-xs font-bold text-link hover:underline"
          >
            条件をすべて外す
          </button>
        )}
      </div>
    </section>
  );
}

function Toggle({
  on,
  onChange,
  children,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cn(
        'inline-flex h-10 cursor-pointer items-center gap-2 border px-3 text-sm font-bold transition-colors duration-150',
        on
          ? 'border-main bg-main-soft text-main'
          : 'border-line-strong bg-surface text-ink-sub hover:border-main-line hover:text-ink',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-4 place-items-center border',
          on ? 'border-main bg-main text-white' : 'border-line-strong bg-surface',
        )}
      >
        {on && <Check className="size-3" strokeWidth={3} />}
      </span>
      {children}
    </button>
  );
}

const PANEL_W = 320;
let nextChipKey = 1000;

/** Menu to pick a field and its value; also edits an existing tag. */
function ConditionEditor({
  initial,
  choicesOf,
  onSave,
  trigger,
}: {
  initial?: FilterChip;
  choicesOf: (field: FilterField) => Choice[] | null;
  onSave: (chip: FilterChip) => void;
  trigger: (open: () => void, ref: React.Ref<HTMLButtonElement>) => ReactNode;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [field, setField] = useState<FilterField | null>(initial?.field ?? null);
  const [value, setValue] = useState(initial?.value ?? '');
  const reset = () => {
    setField(initial?.field ?? null);
    setValue(initial?.value ?? '');
  };
  const pop = usePopover(anchor, panel, { width: PANEL_W, height: 560, onClose: reset });
  const done = (chosen: FilterField, chosenValue: string) => {
    onSave({ key: initial?.key ?? nextChipKey++, field: chosen, value: chosenValue });
    pop.hide();
    if (!initial) {
      setField(null);
      setValue('');
    }
  };
  const pickField = (def: FieldDef) => {
    if (def.noValue) {
      done(def.field, '');
      return;
    }
    setField(def.field);
    setValue('');
  };
  const choices = field ? choicesOf(field) : null;

  return (
    <>
      {trigger(() => (pop.open ? pop.hide() : pop.show()), anchor)}
      <PopoverPanel state={pop} panelRef={panel} width={PANEL_W} label="条件">
        {field === null ? (
          <div className="scroll-quiet max-h-[min(36rem,75dvh)] overflow-y-auto py-1.5">
            <p className="px-3 pt-1 pb-1 text-xs font-bold text-ink-sub">何で絞り込みますか</p>
            {GROUPS.map((group) => (
              <div key={group} className="border-t border-line pt-1 first-of-type:border-t-0">
                <p className="px-3 pt-1.5 pb-0.5 text-[11px] font-bold text-ink-disabled">
                  {group}
                </p>
                {FILTER_FIELDS.filter((def) => def.group === group).map((def) => (
                  <button
                    key={def.field}
                    type="button"
                    onClick={() => pickField(def)}
                    className="flex w-full cursor-pointer items-center px-3 py-1 text-left text-sm hover:bg-main-soft"
                  >
                    {def.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <form
            className="flex flex-col gap-3 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const filled = fieldDef(field).range
                ? value.replace('~', '').trim() !== ''
                : value.trim() !== '';
              if (filled) done(field, value.trim());
            }}
          >
            <div className="flex items-center gap-1">
              {!initial && (
                <button
                  type="button"
                  aria-label="項目を選び直す"
                  onClick={() => setField(null)}
                  className="grid size-7 cursor-pointer place-items-center text-ink-sub hover:bg-hover hover:text-ink"
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                </button>
              )}
              <p className="text-sm font-bold">{fieldDef(field).label}</p>
            </div>
            {fieldDef(field).range ? (
              <RangeInput
                kind={fieldDef(field).range ?? 'date'}
                label={fieldDef(field).label}
                value={value}
                onChange={setValue}
                submitLabel={initial ? '変更する' : '追加する'}
              />
            ) : choices ? (
              <div className="flex flex-col">
                {choices.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    onClick={() => done(field, choice.value)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between px-2.5 py-2 text-left text-sm hover:bg-main-soft',
                      value === choice.value && 'font-bold text-main',
                    )}
                  >
                    {choice.label}
                    {value === choice.value && <Check aria-hidden="true" className="size-4" />}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <TextInput
                  aria-label={fieldDef(field).label}
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
                <p className="-mt-1.5 text-xs text-ink-sub">入れた文字を含むものを探します。</p>
                <Button type="submit" disabled={!value.trim()} fullWidth>
                  {initial ? '変更する' : '追加する'}
                </Button>
              </>
            )}
          </form>
        )}
      </PopoverPanel>
    </>
  );
}

/** From–to for dates (two calendars) or numbers; either side may stay empty. */
function RangeInput({
  kind,
  label,
  value,
  onChange,
  submitLabel,
}: {
  kind: 'date' | 'number';
  label: string;
  value: string;
  onChange: (value: string) => void;
  submitLabel: string;
}) {
  const { from, to } = splitRange(value);
  const set = (next: { from?: string; to?: string }) =>
    onChange(`${next.from ?? from}~${next.to ?? to}`);
  const field = (side: 'from' | 'to') =>
    kind === 'date' ? (
      <DatePicker
        size="sm"
        aria-label={`${label}（${side === 'from' ? 'から' : 'まで'}）`}
        value={side === 'from' ? from : to}
        min={side === 'to' ? from || undefined : undefined}
        max={side === 'from' ? to || undefined : undefined}
        clearable
        onChange={(e) => set({ [side]: e.target.value })}
      />
    ) : (
      <TextInput
        aria-label={`${label}（${side === 'from' ? 'から' : 'まで'}）`}
        inputMode="numeric"
        value={side === 'from' ? from : to}
        onChange={(e) => set({ [side]: e.target.value.replace(/[^\d]/g, '') })}
      />
    );
  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
        {field('from')}
        <span className="text-sm text-ink-sub">〜</span>
        {field('to')}
      </div>
      <p className="-mt-1.5 text-xs text-ink-sub">片方だけでも絞り込めます。</p>
      <Button type="submit" disabled={!from && !to} fullWidth>
        {submitLabel}
      </Button>
    </>
  );
}
