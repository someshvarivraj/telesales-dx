import { addDays, dayOfWeek, weekdayJa } from '@telesales/shared';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { monthRange, startOfWeek, todayJst } from '@/lib/format';
import { cn } from './cn';
import { PopoverPanel, usePopover } from './Popover';
import type { SelectChangeEvent } from './Select';

interface DatePickerProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'value' | 'defaultValue'
> {
  /** yyyy-mm-dd, or '' for none. */
  value: string;
  /** Same shape as a native change event, so callers keep using `e.target.value`. */
  onChange?: (event: SelectChangeEvent) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  /** Show a × to empty the field (filters). */
  clearable?: boolean;
  size?: 'md' | 'sm';
}

const WEEK = ['月', '火', '水', '木', '金', '土', '日'];
const PANEL_W = 304;
const PANEL_H = 392;

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function shiftMonth(month: string, by: number): string {
  const [year, m] = month.split('-').map(Number) as [number, number];
  const target = new Date(Date.UTC(year, m - 1 + by, 1));
  return target.toISOString().slice(0, 10);
}

function isRealDate(iso: string): boolean {
  const time = Date.parse(`${iso}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === iso;
}

/** 今日 / 明日 / 3日後 / 2日前 — a quiet hint next to the date. */
export function relativeDay(date: string, today = todayJst()): string {
  const days = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  if (days === 0) return '今日';
  if (days === 1) return '明日';
  if (days === -1) return '昨日';
  if (days === 2) return '明後日';
  if (Math.abs(days) <= 14) return days > 0 ? `${days}日後` : `${-days}日前`;
  return '';
}

/** Reads 2026/10/28, 2026-10-28, 10/28, 1028 or 28 (this month) typed into the picker. */
export function parseTypedDate(text: string, base: string): string | null {
  const clean = text
    .trim()
    .replace(/[年月]/g, '/')
    .replace(/日/g, '')
    .replace(/[.-]/g, '/');
  const [baseYear = '', baseMonth = ''] = base.split('-');
  let parts = clean.split('/').filter(Boolean);
  const only = parts.length === 1 ? (parts[0] ?? '') : '';
  if (/^\d{3,4}$/.test(only)) {
    const digits = only.padStart(4, '0');
    parts = [digits.slice(0, 2), digits.slice(2)];
  }
  const [y, m, d] =
    parts.length === 3
      ? parts
      : parts.length === 2
        ? [baseYear, parts[0], parts[1]]
        : [baseYear, baseMonth, parts[0]];
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (!year || !month || !day || month > 12 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isRealDate(iso) ? iso : null;
}

/** 2026年10月28日（水） */
function longDate(date: string): string {
  return `${Number(date.slice(0, 4))}年${shortDate(date)}`;
}

/** 10月28日（水） — the year is left out in the field when it is this year. */
function shortDate(date: string): string {
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日（${weekdayJa(date)}）`;
}

/**
 * The app's date field in place of the browser's own: the date written out in Japanese with
 * a 今日/明日 hint, and a month calendar that opens under it — weekends tinted, today ringed,
 * quick picks, a box to type a date, and full keyboard use (← → ↑ ↓ PageUp PageDown Home End).
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = '日付を選ぶ',
  clearable = false,
  size = 'md',
  disabled,
  className,
  id,
  ...rest
}: DatePickerProps) {
  const autoId = useId();
  const triggerId = id ?? autoId;
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const today = todayJst();
  const [month, setMonth] = useState(() => monthStart(value || today));
  const [focus, setFocus] = useState(value || today);
  const [typed, setTyped] = useState('');
  const onClose = useCallback(() => setTyped(''), []);
  const popover = usePopover(trigger, panel, { width: PANEL_W, height: PANEL_H, onClose });

  const outOfRange = (date: string) => Boolean((min && date < min) || (max && date > max));

  const open = () => {
    if (disabled) return;
    const start = value || (min && today < min ? min : today);
    setMonth(monthStart(start));
    setFocus(start);
    popover.show();
  };
  const close = (refocus = true) => {
    popover.hide();
    setTyped('');
    if (refocus) trigger.current?.focus();
  };
  const choose = (date: string) => {
    if (outOfRange(date)) return;
    if (date !== value) onChange?.({ target: { value: date } });
    close();
  };

  useEffect(() => {
    if (!popover.open) return;
    grid.current?.querySelector<HTMLElement>(`[data-date="${focus}"]`)?.focus();
  }, [popover.open, focus, month]);

  const moveFocus = (date: string) => {
    setFocus(date);
    if (monthStart(date) !== month) setMonth(monthStart(date));
  };

  const onGridKey = (event: KeyboardEvent) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      Home: () => startOfWeek(focus),
      End: () => addDays(startOfWeek(focus), 6),
      PageUp: () => shiftMonth(focus, -1).slice(0, 8) + focus.slice(8),
      PageDown: () => shiftMonth(focus, 1).slice(0, 8) + focus.slice(8),
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      const next = move();
      // 31st → a shorter month: land on its last day.
      moveFocus(isRealDate(next) ? next : monthRange(`${next.slice(0, 7)}-01`).to);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(focus);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  const { from, to } = monthRange(month);
  const first = startOfWeek(from);
  const days: string[] = [];
  for (let day = first; day <= to || days.length % 7 !== 0; day = addDays(day, 1)) days.push(day);
  const hint = value ? relativeDay(value, today) : '';
  const quick = [
    { label: '今日', date: today },
    { label: '明日', date: addDays(today, 1) },
    { label: '来週の月曜', date: addDays(startOfWeek(today), 7) },
  ];
  const height = size === 'sm' ? 'h-9 text-sm' : 'h-11 text-base';

  return (
    <div className={cn('relative', className)}>
      <button
        {...rest}
        ref={trigger}
        id={triggerId}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={popover.open}
        disabled={disabled}
        onClick={() => (popover.open ? close() : open())}
        onKeyDown={(event) => {
          if (!popover.open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
            event.preventDefault();
            open();
          }
        }}
        className={cn(
          'group flex w-full cursor-pointer items-center gap-2.5 border border-line-strong bg-surface pr-3 pl-3 text-left text-ink transition-[border-color,box-shadow] duration-150',
          'hover:border-main-line focus:border-main-focus focus:ring-3 focus:ring-main-focus/20 focus:outline-none',
          'aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:bg-column disabled:text-ink-disabled',
          popover.open && 'border-main-focus ring-3 ring-main-focus/20',
          clearable && value && 'pr-9',
          height,
        )}
      >
        <CalendarDays
          aria-hidden="true"
          className="size-4 shrink-0 text-ink-sub transition-colors group-hover:text-main"
        />
        <span className={cn('min-w-0 flex-1 truncate tabular-nums', !value && 'text-ink-disabled')}>
          {value
            ? value.slice(0, 4) === today.slice(0, 4)
              ? shortDate(value)
              : longDate(value)
            : placeholder}
        </span>
        {hint && !disabled && !(clearable && value) && (
          <span className="shrink-0 bg-column px-1.5 text-[11px] leading-5 font-bold text-ink-sub">
            {hint}
          </span>
        )}
      </button>
      {clearable && value && !disabled && (
        <button
          type="button"
          aria-label="日付を消す"
          onClick={() => onChange?.({ target: { value: '' } })}
          className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center text-ink-sub hover:bg-column hover:text-ink"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      )}

      <PopoverPanel state={popover} panelRef={panel} width={PANEL_W} label="日付を選ぶ">
        <div className="border-b border-line p-2">
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                const parsed = parseTypedDate(typed, value || today);
                if (parsed) choose(parsed);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                close();
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                grid.current?.querySelector<HTMLElement>(`[data-date="${focus}"]`)?.focus();
              }
            }}
            placeholder="入力もできます（例：10/28）"
            aria-label="日付を入力"
            className="h-8 w-full border border-line bg-canvas px-2.5 text-sm tabular-nums placeholder:text-ink-disabled focus:border-main-focus focus:bg-surface focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1 px-3 pt-2.5 pb-1">
          <p className="flex-1 text-[15px] font-bold tabular-nums" aria-live="polite">
            {Number(month.slice(0, 4))}年
            <span className="ml-0.5">{Number(month.slice(5, 7))}月</span>
          </p>
          <button
            type="button"
            aria-label="前の月"
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="flex size-8 cursor-pointer items-center justify-center text-ink-sub hover:bg-column hover:text-ink"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="次の月"
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="flex size-8 cursor-pointer items-center justify-center text-ink-sub hover:bg-column hover:text-ink"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div
          ref={grid}
          role="grid"
          aria-label={`${Number(month.slice(0, 4))}年${Number(month.slice(5, 7))}月`}
          onKeyDown={onGridKey}
          className="px-2.5 pb-2"
        >
          <div role="row" className="grid grid-cols-7 text-center text-[11px] font-bold">
            {WEEK.map((label, index) => (
              <span
                key={label}
                role="columnheader"
                className={cn(
                  'py-1',
                  index === 5 ? 'text-saturday' : index === 6 ? 'text-sunday' : 'text-ink-sub',
                )}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {days.map((date) => {
              const inMonth = date >= from && date <= to;
              const selected = date === value;
              const isToday = date === today;
              const blocked = outOfRange(date);
              const dow = dayOfWeek(date);
              return (
                <button
                  key={date}
                  type="button"
                  role="gridcell"
                  data-date={date}
                  tabIndex={date === focus ? 0 : -1}
                  aria-selected={selected}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={longDate(date)}
                  disabled={blocked}
                  onClick={() => choose(date)}
                  onFocus={() => setFocus(date)}
                  className={cn(
                    'relative mx-auto flex size-9 cursor-pointer items-center justify-center text-sm tabular-nums transition-colors duration-100',
                    'focus-visible:outline-2 focus-visible:outline-offset-0',
                    !inMonth && 'text-ink-disabled',
                    inMonth && dow === 6 && 'text-saturday',
                    inMonth && dow === 0 && 'text-sunday',
                    !selected && !blocked && 'hover:bg-main-soft',
                    isToday && !selected && 'font-bold ring-1 ring-ink/70 ring-inset',
                    selected && 'bg-main font-bold text-white',
                    blocked && 'cursor-not-allowed opacity-30 line-through',
                  )}
                >
                  {Number(date.slice(8))}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 border-t border-line px-2.5 py-2">
          {quick.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={outOfRange(item.date)}
              onClick={() => choose(item.date)}
              className="h-7 cursor-pointer border border-line px-2.5 text-xs font-bold text-ink-sub hover:border-main-line hover:bg-main-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              {item.label}
            </button>
          ))}
          {clearable && value && (
            <button
              type="button"
              onClick={() => {
                onChange?.({ target: { value: '' } });
                close();
              }}
              className="ml-auto h-7 cursor-pointer px-2 text-xs text-ink-sub hover:text-danger"
            >
              クリア
            </button>
          )}
        </div>
      </PopoverPanel>
    </div>
  );
}
