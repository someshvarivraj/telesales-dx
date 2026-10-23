import { SLOT_MINUTES } from '@telesales/shared';
import { Clock } from 'lucide-react';
import {
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { timeOptions } from '@/lib/format';
import { cn } from './cn';
import { PopoverPanel, usePopover } from './Popover';
import type { SelectChangeEvent } from './Select';

interface TimePickerProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'value' | 'defaultValue'
> {
  /** HH:MM */
  value: string;
  onChange?: (event: SelectChangeEvent) => void;
  /** First and last hour offered (15-minute steps). */
  fromHour?: number;
  toHour?: number;
  /** Only times after this one (an end time after its start). */
  after?: string;
  /** Show the length from this time next to each option: 「11:00 · 1時間」. */
  durationFrom?: string;
  size?: 'md' | 'sm';
}

const PANEL_W = 220;
const PANEL_H = 320;

function toMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** 30分 / 1時間 / 1時間30分 */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}時間${rest}分` : `${hours}時間`;
}

/** Reads 1030, 10:30, 10時30分, 10時半 or 9 into HH:MM, rounded down to 15 minutes. */
export function parseTypedTime(text: string): string | null {
  const clean = text
    .trim()
    .replace('時半', ':30')
    .replace(/[時：]/g, ':')
    .replace('分', '');
  let hours: number;
  let minutes: number;
  if (/^\d{1,2}$/.test(clean)) {
    hours = Number(clean);
    minutes = 0;
  } else if (/^\d{3,4}$/.test(clean)) {
    hours = Number(clean.slice(0, -2));
    minutes = Number(clean.slice(-2));
  } else {
    const match = clean.match(/^(\d{1,2}):(\d{0,2})$/);
    if (!match) return null;
    hours = Number(match[1]);
    minutes = Number(match[2] || 0);
  }
  if (hours > 23 || minutes > 59) return null;
  const snapped = Math.floor(minutes / SLOT_MINUTES) * SLOT_MINUTES;
  return `${String(hours).padStart(2, '0')}:${String(snapped).padStart(2, '0')}`;
}

/**
 * Time field: type it (「1030」「10時半」) or pick from a 15-minute list that opens on the
 * chosen time; end times show how long the plan becomes, as in Google Calendar.
 */
export function TimePicker({
  value,
  onChange,
  fromHour = 7,
  toHour = 21,
  after,
  durationFrom,
  size = 'md',
  disabled,
  className,
  id,
  ...rest
}: TimePickerProps) {
  const autoId = useId();
  const triggerId = id ?? autoId;
  const listId = `${triggerId}-list`;
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState('');
  const [active, setActive] = useState(0);
  const onClose = useCallback(() => setTyped(''), []);
  const popover = usePopover(trigger, panel, { width: PANEL_W, height: PANEL_H, onClose });

  const times = timeOptions(fromHour, toHour).filter((time) => !after || time > after);
  const parsed = typed ? parseTypedTime(typed) : null;

  const close = (refocus = true) => {
    popover.hide();
    setTyped('');
    if (refocus) trigger.current?.focus();
  };
  const choose = (time: string | null | undefined) => {
    if (!time || (after && time <= after)) return;
    if (time !== value) onChange?.({ target: { value: time } });
    close();
  };
  const open = () => {
    if (disabled) return;
    setActive(Math.max(0, times.indexOf(value)));
    popover.show();
  };

  useEffect(() => {
    if (!popover.open) return;
    input.current?.focus();
    const item = list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (item && 'scrollIntoView' in item) item.scrollIntoView({ block: 'nearest' });
  }, [popover.open, active]);

  const onKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive((index) => Math.min(index + 1, times.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive((index) => Math.max(index - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        choose(parsed && times.includes(parsed) ? parsed : times[active]);
        break;
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  const base = durationFrom ? toMinutes(durationFrom) : null;
  const height = size === 'sm' ? 'h-9 text-sm' : 'h-11 text-base';

  return (
    <div className={cn('relative', className)}>
      <button
        {...rest}
        ref={trigger}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={popover.open}
        aria-controls={popover.open ? listId : undefined}
        disabled={disabled}
        onClick={() => (popover.open ? close() : open())}
        onKeyDown={(event) => {
          if (!popover.open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
            event.preventDefault();
            open();
          }
        }}
        className={cn(
          'group flex w-full cursor-pointer items-center gap-2 border border-line-strong bg-surface px-3 text-left text-ink tabular-nums transition-[border-color,box-shadow] duration-150',
          'hover:border-main-line focus:border-main-focus focus:ring-3 focus:ring-main-focus/20 focus:outline-none',
          'aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:bg-column disabled:text-ink-disabled',
          popover.open && 'border-main-focus ring-3 ring-main-focus/20',
          height,
        )}
      >
        <Clock
          aria-hidden="true"
          className="size-4 shrink-0 text-ink-sub transition-colors group-hover:text-main"
        />
        <span className="min-w-0 flex-1 truncate">{value || '--:--'}</span>
        {base !== null && value && toMinutes(value) > base && (
          <span className="shrink-0 text-[11px] text-ink-sub">
            {durationLabel(toMinutes(value) - base)}
          </span>
        )}
      </button>

      <PopoverPanel state={popover} panelRef={panel} width={PANEL_W} label="時刻を選ぶ">
        <div className="border-b border-line p-2">
          <input
            ref={input}
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
              // Typing jumps the list to the nearest time.
              const time = parseTypedTime(event.target.value);
              const index = time ? times.findIndex((t) => t >= time) : -1;
              if (index >= 0) setActive(index);
            }}
            onKeyDown={onKeyDown}
            inputMode="numeric"
            placeholder="例：1030・10時半"
            aria-label="時刻を入力"
            aria-controls={listId}
            className="h-8 w-full border border-line bg-canvas px-2.5 text-sm tabular-nums placeholder:text-ink-disabled focus:border-main-focus focus:bg-surface focus:outline-none"
          />
          {typed && !parsed && <p className="mt-1 text-[11px] text-danger">時刻として読めません</p>}
        </div>
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-labelledby={triggerId}
          className="scroll-quiet max-h-64 overflow-y-auto py-1"
        >
          {times.map((time, index) => {
            const selected = time === value;
            const onHour = time.endsWith(':00');
            return (
              <li
                key={time}
                role="option"
                aria-selected={selected}
                data-index={index}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(time)}
                className={cn(
                  'flex h-8 cursor-pointer items-center gap-2 px-3 text-sm tabular-nums',
                  index === active && 'bg-hover',
                  selected && 'bg-main-soft font-bold',
                  onHour ? 'text-ink' : 'text-ink-sub',
                )}
              >
                <span className={cn('w-11', selected && 'text-ink')}>{time}</span>
                {base !== null && toMinutes(time) > base && (
                  <span className="text-xs text-ink-sub">
                    {durationLabel(toMinutes(time) - base)}
                  </span>
                )}
                {selected && <span className="ml-auto size-1.5 bg-main" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      </PopoverPanel>
    </div>
  );
}
