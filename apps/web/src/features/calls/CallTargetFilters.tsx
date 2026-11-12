import {
  BLANK_VALUE,
  type CompanyFilterCondition,
  formatCapital,
  parseCapital,
  splitRange,
} from '@telesales/shared';
import { Check, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { DatePicker } from '@/components/ui/DatePicker';
import { cn } from '@/components/ui/cn';
import { PopoverPanel, usePopover } from '@/components/ui/Popover';
import { Segmented } from '@/components/ui/Segmented';

export type FilterField = CompanyFilterCondition['field'];

export interface FilterChip {
  key: number;
  field: FilterField;
  value: string;
  /** Several picks; a company matches any of them. */
  values: string[];
}

export interface Choice {
  value: string;
  label: string;
  /** A detailed item under the one above it. */
  nested?: boolean;
}

type Control = 'text' | 'multi' | 'free' | 'check' | 'date' | 'number' | 'yen';

interface FieldDef {
  field: FilterField;
  label: string;
  control: Control;
  /** 「空白」 can be picked. */
  blank?: boolean;
  blankLabel?: string;
}

/**
 * 詳細検索: the items and order of the existing system's search screen, marked up by the
 * telemarketing team (request 11/2): free input, multi-select with 空白, free word + multi-select.
 */
const COLUMNS: { title: string; fields: FieldDef[] }[] = [
  {
    title: '架電・担当',
    fields: [
      { field: 'telemaIdNo', label: 'テレマIDNo', control: 'number' },
      {
        field: 'lastGrade',
        label: '最新テレマ結果',
        control: 'multi',
        blank: true,
        blankLabel: '空白（未架電）',
      },
      { field: 'industry', label: '業種', control: 'multi', blank: true },
      { field: 'companyRank', label: '企業ランク', control: 'multi', blank: true },
      { field: 'department', label: '担当者部署', control: 'text' },
      { field: 'salesRep', label: '営業担当者', control: 'multi' },
      { field: 'telemarketer', label: 'テレマ担当者', control: 'multi' },
    ],
  },
  {
    title: '企業',
    fields: [
      { field: 'listName', label: 'リスト名', control: 'text' },
      { field: 'name', label: '会社名', control: 'text' },
      { field: 'office', label: '事業所名', control: 'free', blank: true },
      { field: 'postalCode', label: '郵便番号', control: 'text' },
      { field: 'address', label: '住所', control: 'free' },
      { field: 'nearestStation', label: '最寄駅', control: 'text' },
      { field: 'phone', label: '電話番号', control: 'text' },
      { field: 'remarks', label: '備考', control: 'text' },
    ],
  },
  {
    title: '日付・金額',
    fields: [
      { field: 'neverCalled', label: '未架電', control: 'check' },
      { field: 'lastCallDate', label: '最新テレマ日', control: 'date' },
      { field: 'importedDate', label: '取込日', control: 'date' },
      { field: 'nextCallDate', label: 'テレマ予定日', control: 'date' },
      { field: 'visitDate', label: '訪問確認日', control: 'date' },
      { field: 'capital', label: '資本金', control: 'yen' },
      { field: 'headOffice', label: '本社', control: 'check' },
      { field: 'visitCancelled', label: '訪問キャンセル', control: 'check' },
    ],
  },
  {
    title: 'その他',
    fields: [
      { field: 'customerType', label: '取引区分', control: 'multi' },
      { field: 'flag', label: '重複・要確認', control: 'multi' },
      { field: 'nextCallDue', label: 'B次回架電日が到来', control: 'check' },
    ],
  },
];
const FIELDS = COLUMNS.flatMap((column) => column.fields);

export function fieldDef(field: FilterField): FieldDef {
  return FIELDS.find((def) => def.field === field) ?? { field, label: field, control: 'text' };
}

/** Which list (request 11/2): today's call targets, the ones kept for later, or every company. */
export type CallList = 'TARGETS' | 'NON_TARGETS' | 'ALL';

const LIST_OPTIONS: { value: CallList; label: string; hint: string }[] = [
  { value: 'TARGETS', label: '架電対象', hint: 'いま架電する企業' },
  {
    value: 'NON_TARGETS',
    label: '架電対象外',
    hint: 'あとで架電する企業（取り込み時に「あとで」を選んだリストなど）',
  },
  { value: 'ALL', label: 'すべて', hint: '登録されているすべての企業' },
];

interface CallTargetFiltersProps {
  name: string;
  onName: (name: string) => void;
  chips: FilterChip[];
  onChips: (chips: FilterChip[]) => void;
  match: 'AND' | 'OR';
  onMatch: (match: 'AND' | 'OR') => void;
  list: CallList;
  onList: (list: CallList) => void;
  onlyMine: boolean;
  onOnlyMine: (on: boolean) => void;
  choicesOf: (field: FilterField) => Choice[];
}

let nextChipKey = 1000;

/** 「2026/10/01〜2026/10/31」, 「5,000万円〜」 … */
function rangeLabel(chip: FilterChip, control: Control): string {
  const { from, to } = splitRange(chip.value);
  const show = (part: string) => {
    if (!part) return '';
    if (control === 'yen') return formatCapital(Number(part)) ?? part;
    return part.replaceAll('-', '/');
  };
  return `${show(from)}〜${show(to)}`;
}

/**
 * The bar above the call target list: a keyword box, the list switches, and 詳細検索 with every
 * item of the existing search screen. What is set shows as tags. Results follow as you change it.
 */
export function CallTargetFilters(props: CallTargetFiltersProps) {
  const { chips, onChips, choicesOf } = props;
  const [panelOpen, setPanelOpen] = useState(false);
  const chipOf = (field: FilterField) => chips.find((chip) => chip.field === field);
  /** Sets one field: nothing entered takes its tag away. */
  const setField = (field: FilterField, next: { value?: string; values?: string[] } | null) => {
    if (!next) {
      onChips(chips.filter((chip) => chip.field !== field));
      return;
    }
    const chip: FilterChip = {
      key: chipOf(field)?.key ?? nextChipKey++,
      field,
      value: next.value ?? '',
      values: next.values ?? [],
    };
    onChips(chipOf(field) ? chips.map((c) => (c.field === field ? chip : c)) : [...chips, chip]);
  };
  const labelOf = (chip: FilterChip) => {
    const def = fieldDef(chip.field);
    if (def.control === 'check') return def.label;
    const text =
      def.control === 'date' || def.control === 'number' || def.control === 'yen'
        ? rangeLabel(chip, def.control)
        : (chip.values.length > 0 ? chip.values : [chip.value])
            .map((value) => pickLabel(value, def, choicesOf(chip.field)))
            .join('、');
    return (
      <>
        <span className="font-normal text-ink-sub">{def.label}：</span>
        <span data-no-translate="">{text}</span>
      </>
    );
  };

  return (
    <section aria-label="絞り込み" className="border border-line bg-surface shadow-(--shadow-card)">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <label className="relative w-full sm:w-[26rem]">
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
        <button
          type="button"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen(!panelOpen)}
          className={cn(
            'inline-flex h-10 cursor-pointer items-center gap-2 border px-3 text-sm font-bold transition-colors duration-150',
            panelOpen || chips.length > 0
              ? 'border-main bg-main-soft text-main'
              : 'border-line-strong bg-surface text-ink-sub hover:border-main-line hover:text-ink',
          )}
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          詳細検索
          {chips.length > 0 && (
            <span className="grid h-5 min-w-5 place-items-center bg-main px-1 text-xs text-white tabular-nums">
              {chips.length}
            </span>
          )}
          <ChevronDown
            aria-hidden="true"
            className={cn('size-4 transition-transform duration-150', panelOpen && 'rotate-180')}
          />
        </button>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Segmented
            aria-label="リスト"
            size="sm"
            value={props.list}
            onChange={props.onList}
            options={LIST_OPTIONS}
          />
          <Toggle on={props.onlyMine} onChange={props.onOnlyMine}>
            今日の自分の担当だけ
          </Toggle>
        </div>
      </div>

      {panelOpen && (
        <div className="grid gap-x-8 gap-y-5 border-t border-line p-4 [grid-template-columns:repeat(auto-fit,minmax(min(21rem,100%),1fr))]">
          {COLUMNS.map((column) => (
            <fieldset
              key={column.title}
              className={cn('min-w-0', column.title === 'その他' && 'col-span-full')}
            >
              <legend className="mb-2 w-full border-b border-line pb-1 text-xs font-bold text-ink-sub">
                {column.title}
              </legend>
              <div
                className={
                  column.title === 'その他'
                    ? 'grid gap-x-8 gap-y-1.5 [grid-template-columns:repeat(auto-fit,minmax(min(21rem,100%),1fr))]'
                    : 'flex flex-col gap-1.5'
                }
              >
                {column.fields.map((def) => (
                  <SearchRow
                    key={def.field}
                    def={def}
                    chip={chipOf(def.field)}
                    choices={choicesOf(def.field)}
                    onChange={(next) => setField(def.field, next)}
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-column px-3 py-2.5">
          <span className="mr-1 text-xs font-bold text-ink-sub">条件</span>
          {chips.map((chip, index) => (
            <span key={chip.key} className="contents">
              {index > 0 && (
                <span className="text-[11px] font-bold text-ink-sub">
                  {props.match === 'AND' ? 'かつ' : 'または'}
                </span>
              )}
              <span className="inline-flex h-8 max-w-full items-stretch border border-main-line bg-surface text-sm">
                <button
                  type="button"
                  onClick={() => setPanelOpen(true)}
                  className="max-w-80 cursor-pointer truncate px-2.5 font-bold text-ink hover:bg-main-soft"
                >
                  {labelOf(chip)}
                </button>
                <button
                  type="button"
                  aria-label="この条件を外す"
                  onClick={() => setField(chip.field, null)}
                  className="grid w-7 shrink-0 cursor-pointer place-items-center border-l border-main-line text-ink-sub hover:bg-main-soft hover:text-ink"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </span>
            </span>
          ))}
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
          <button
            type="button"
            onClick={() => onChips([])}
            className="ml-auto inline-flex h-8 cursor-pointer items-center gap-1 px-2 text-xs font-bold text-ink-sub transition-colors hover:bg-surface hover:text-ink"
          >
            <X aria-hidden="true" className="size-3.5" />
            条件をすべて外す
          </button>
        </div>
      )}
    </section>
  );
}

function pickLabel(value: string, def: FieldDef, choices: Choice[]): string {
  if (value === BLANK_VALUE) return def.blankLabel ?? '空白';
  return choices.find((choice) => choice.value === value)?.label ?? value;
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

const FIELD_CLASS =
  'h-8 w-full min-w-0 border border-line-strong bg-surface px-2 text-sm placeholder:text-ink-disabled focus:border-main-focus focus:outline-none';

/** One item of 詳細検索: its label, marked while it is in use, and its input. */
function SearchRow({
  def,
  chip,
  choices,
  onChange,
}: {
  def: FieldDef;
  chip: FilterChip | undefined;
  choices: Choice[];
  onChange: (next: { value?: string; values?: string[] } | null) => void;
}) {
  if (def.control === 'check') {
    return (
      <label className="grid min-h-8 cursor-pointer grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2 text-sm">
        <span className={cn('text-xs', chip ? 'font-bold text-main' : 'text-ink-sub')}>
          {def.label}
        </span>
        <input
          type="checkbox"
          className="check-input"
          checked={!!chip}
          onChange={(event) => onChange(event.target.checked ? {} : null)}
        />
      </label>
    );
  }
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2">
      <span className={cn('text-xs', chip ? 'font-bold text-main' : 'text-ink-sub')}>
        {def.label}
      </span>
      {def.control === 'text' ? (
        <TextControl
          label={def.label}
          value={chip?.value ?? ''}
          onChange={(value) => onChange(value ? { value } : null)}
        />
      ) : def.control === 'multi' || def.control === 'free' ? (
        <MultiControl
          def={def}
          choices={choices}
          picks={chip?.values.length ? chip.values : chip?.value ? [chip.value] : []}
          onChange={(values) => onChange(values.length > 0 ? { values } : null)}
        />
      ) : (
        <RangeControl
          kind={def.control}
          label={def.label}
          value={chip?.value ?? ''}
          onChange={(value) => onChange(value.replace('~', '').trim() ? { value } : null)}
        />
      )}
    </div>
  );
}

/** Free input: the search follows shortly after typing stops. */
function TextControl({
  label,
  value,
  onChange,
  invalid,
  inputMode,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  inputMode?: 'numeric';
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  // Follows a change from outside (the tag removed, 条件をすべて外す).
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setText(value);
  }
  useEffect(() => {
    if (text.trim() === value) return;
    const timer = setTimeout(() => onChange(text.trim()), 350);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);
  return (
    <input
      aria-label={label}
      aria-invalid={invalid}
      inputMode={inputMode}
      placeholder={placeholder}
      value={text}
      onChange={(event) => setText(event.target.value)}
      className={cn(FIELD_CLASS, invalid && 'border-danger')}
    />
  );
}

/** From–to; either side may stay empty. 資本金 takes 「5000万」 as well as plain numbers. */
function RangeControl({
  kind,
  label,
  value,
  onChange,
}: {
  kind: 'date' | 'number' | 'yen';
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { from, to } = splitRange(value);
  const set = (next: { from?: string; to?: string }) =>
    onChange(`${next.from ?? from}~${next.to ?? to}`);
  const side = (name: 'from' | 'to') => {
    const current = name === 'from' ? from : to;
    const aria = `${label}（${name === 'from' ? 'から' : 'まで'}）`;
    if (kind === 'date') {
      return (
        <DatePicker
          size="sm"
          aria-label={aria}
          value={current}
          min={name === 'to' ? from || undefined : undefined}
          max={name === 'from' ? to || undefined : undefined}
          clearable
          onChange={(e) => set({ [name]: e.target.value })}
        />
      );
    }
    if (kind === 'yen') {
      return <YenInput label={aria} value={current} onChange={(yen) => set({ [name]: yen })} />;
    }
    return (
      <TextControl
        label={aria}
        inputMode="numeric"
        value={current}
        onChange={(text) => set({ [name]: text.replace(/[^\d]/g, '') })}
      />
    );
  };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1">
      {side('from')}
      <span className="text-xs text-ink-sub">〜</span>
      {side('to')}
    </div>
  );
}

/** Yen, typed the way people say it; shown back in 億・万 when it is read. */
function YenInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (yen: string) => void;
}) {
  const shown = value ? (formatCapital(Number(value)) ?? value) : '';
  const [text, setText] = useState(shown);
  const [seen, setSeen] = useState(shown);
  if (shown !== seen) {
    setSeen(shown);
    setText(shown);
  }
  const parsed = parseCapital(text);
  const invalid = text.trim() !== '' && parsed === null;
  const next = parsed === null ? '' : String(parsed);
  useEffect(() => {
    if (invalid || next === value) return;
    const timer = setTimeout(() => onChange(next), 500);
    return () => clearTimeout(timer);
  }, [invalid, next, value, onChange]);
  return (
    <input
      aria-label={label}
      aria-invalid={invalid}
      placeholder="5000万"
      value={text}
      onChange={(event) => setText(event.target.value)}
      className={cn(FIELD_CLASS, invalid && 'border-danger')}
    />
  );
}

const PANEL_W = 300;

/**
 * Multi-select, with 空白 where the team asked for it. 「free」 fields also take any typed word
 * (事業所名, 住所: 本社＋支社, 大阪市＋神戸市).
 */
function MultiControl({
  def,
  choices,
  picks,
  onChange,
}: {
  def: FieldDef;
  choices: Choice[];
  picks: string[];
  onChange: (values: string[]) => void;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const pop = usePopover(anchor, panel, {
    width: PANEL_W,
    height: 420,
    onClose: () => setSearch(''),
  });
  const free = def.control === 'free';
  const word = search.trim();
  const shown = choices.filter((choice) => !word || choice.label.includes(word));
  const typed = picks
    .filter((pick) => pick !== BLANK_VALUE && !choices.some((c) => c.value === pick))
    .map((pick) => ({ value: pick, label: pick }));
  const toggle = (value: string) =>
    onChange(picks.includes(value) ? picks.filter((p) => p !== value) : [...picks, value]);
  const addTyped = () => {
    if (!free || !word) return;
    if (!picks.includes(word)) onChange([...picks, word]);
    setSearch('');
  };
  const row = (value: string, label: string, nested?: boolean) => (
    <label
      key={value}
      className={cn(
        'flex min-h-9 cursor-pointer items-center gap-2.5 px-3 py-1 text-sm hover:bg-main-soft',
        nested && 'pl-8',
        picks.includes(value) && 'font-bold',
      )}
    >
      <input
        type="checkbox"
        className="check-input"
        checked={picks.includes(value)}
        onChange={() => toggle(value)}
      />
      <span data-no-translate="">{label}</span>
    </label>
  );

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={pop.open}
        onClick={() => (pop.open ? pop.hide() : pop.show())}
        className={cn(
          FIELD_CLASS,
          'flex cursor-pointer items-center gap-1 text-left',
          pop.open && 'border-main-focus',
        )}
      >
        <span
          data-no-translate=""
          className={cn('min-w-0 flex-1 truncate', picks.length === 0 && 'text-ink-disabled')}
        >
          {picks.length === 0
            ? free
              ? '入力・複数選択'
              : '複数選択'
            : picks.map((pick) => pickLabel(pick, def, choices)).join('、')}
        </span>
        {picks.length > 1 && (
          <span className="bg-main px-1 text-[11px] font-bold text-white tabular-nums">
            {picks.length}
          </span>
        )}
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-ink-sub" />
      </button>
      <PopoverPanel state={pop} panelRef={panel} width={PANEL_W} label={def.label}>
        {(free || choices.length > 8) && (
          <form
            className="border-b border-line p-2"
            onSubmit={(event) => {
              event.preventDefault();
              addTyped();
            }}
          >
            <input
              autoFocus
              aria-label={`${def.label}を${free ? '入力' : '探す'}`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={free ? '入力して Enter で追加' : '探す'}
              className={FIELD_CLASS}
            />
          </form>
        )}
        <div className="scroll-quiet max-h-72 overflow-y-auto py-1">
          {free && word && !picks.includes(word) && !choices.some((c) => c.value === word) && (
            <button
              type="button"
              onClick={addTyped}
              className="flex min-h-9 w-full cursor-pointer items-center px-3 text-left text-sm font-bold text-main hover:bg-main-soft"
            >
              {`「${word}」を含む`}
            </button>
          )}
          {def.blank && !word && row(BLANK_VALUE, def.blankLabel ?? '空白')}
          {typed.map((choice) => row(choice.value, choice.label))}
          {shown.map((choice) => row(choice.value, choice.label, choice.nested))}
          {shown.length === 0 && !free && (
            <p className="px-3 py-2 text-sm text-ink-sub">見つかりません</p>
          )}
        </div>
        {picks.length > 0 && (
          <div className="flex items-center justify-between border-t border-line px-3 py-1.5">
            <span className="text-xs text-ink-sub">{`${picks.length}件を選択（どれかに当てはまる）`}</span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="h-7 cursor-pointer border border-line-strong bg-surface px-2.5 text-xs font-bold text-ink hover:border-main-line hover:bg-main-soft"
            >
              クリア
            </button>
          </div>
        )}
      </PopoverPanel>
    </>
  );
}
