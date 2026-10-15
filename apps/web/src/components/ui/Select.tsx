import { Check, ChevronDown, Search } from 'lucide-react';
import {
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

export interface SelectOption {
  value: string;
  label: string;
  /** Shown before the label, e.g. a flag or a colour dot. */
  icon?: ReactNode;
}

/** Same shape as a native change event, so callers keep using `e.target.value`. */
export interface SelectChangeEvent {
  target: { value: string };
}

interface SelectProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'value' | 'defaultValue'
> {
  options: readonly SelectOption[];
  value: string;
  onChange?: (event: SelectChangeEvent) => void;
  /** Adds an empty first choice, e.g. 「選択してください」. */
  placeholder?: string;
  /** `sm` for toolbars and compact rows. */
  size?: 'md' | 'sm';
}

/** Long lists (prefectures, people) get a search box. */
const SEARCH_FROM = 12;
const LIST_MAX_HEIGHT = 288;

interface Position {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
}

/**
 * The app's dropdown, in place of the browser's own: square, the same border and focus
 * ring as text inputs, a check on the chosen item, keyboard support (↑ ↓ Home End Enter
 * Esc, type to jump) and a search box for long lists. The list is drawn in a fixed layer
 * (inside the open dialog, if any) so scrolling areas and tables never clip it.
 */
export function Select({
  options,
  value,
  onChange,
  placeholder,
  size = 'md',
  className,
  disabled,
  id,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const triggerId = id ?? autoId;
  const listId = `${triggerId}-list`;
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<Position | null>(null);
  /** Where the list is drawn: inside a modal <dialog> the rest of the page is inert. */
  const [layer, setLayer] = useState<HTMLElement | null>(null);

  const all: SelectOption[] =
    placeholder !== undefined ? [{ value: '', label: placeholder }, ...options] : [...options];
  const searchable = options.length >= SEARCH_FROM;
  const shown = query
    ? all.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()))
    : all;
  const selected = all.find((option) => option.value === value);

  const place = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom;
    const width = Math.max(rect.width, 192);
    const left = Math.min(rect.left, window.innerWidth - width - 8);
    setPosition(
      below < LIST_MAX_HEIGHT + 16 && rect.top > below
        ? { left, width, bottom: window.innerHeight - rect.top + 4 }
        : { left, width, top: rect.bottom + 4 },
    );
  }, []);

  const close = useCallback((focusTrigger = true) => {
    setOpen(false);
    setQuery('');
    if (focusTrigger) trigger.current?.focus();
  }, []);

  const openList = () => {
    if (disabled) return;
    setLayer(trigger.current?.closest('dialog') ?? document.body);
    place();
    setActive(
      Math.max(
        0,
        all.findIndex((option) => option.value === value),
      ),
    );
    setOpen(true);
  };

  const choose = (option: SelectOption | undefined) => {
    if (!option) return;
    if (option.value !== value) onChange?.({ target: { value: option.value } });
    close();
  };

  useLayoutEffect(() => {
    if (!open) return;
    if (searchable) search.current?.focus();
    const item = list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    // Keep the highlighted item in view (not available in every environment, e.g. tests).
    if (item && 'scrollIntoView' in item) item.scrollIntoView({ block: 'nearest' });
  }, [open, active, searchable]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !list.current?.contains(target)) close(false);
    };
    const reposition = (event: Event) => {
      if (list.current?.contains(event.target as Node)) return;
      place();
    };
    document.addEventListener('mousedown', outside);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', outside);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, close, place]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    const last = shown.length - 1;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive((index) => Math.min(index + 1, last));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive((index) => Math.max(index - 1, 0));
        break;
      case 'Home':
        event.preventDefault();
        setActive(0);
        break;
      case 'End':
        event.preventDefault();
        setActive(last);
        break;
      case 'Enter':
        event.preventDefault();
        choose(shown[active]);
        break;
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'Tab':
        close(false);
        break;
      default:
        // Type a letter to jump (lists without a search box).
        if (!searchable && event.key.length === 1) {
          const index = shown.findIndex((option) =>
            option.label.toLowerCase().startsWith(event.key.toLowerCase()),
          );
          if (index >= 0) setActive(index);
        }
    }
  };

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
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={cn(
          'flex w-full cursor-pointer items-center gap-2 border border-line-strong bg-surface pr-9 pl-3 text-left text-ink transition-colors duration-150',
          'hover:border-main-line focus:border-main-focus focus:ring-3 focus:ring-main-focus/20 focus:outline-none',
          'aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:bg-column disabled:text-ink-disabled',
          open && 'border-main-focus ring-3 ring-main-focus/20',
          height,
        )}
      >
        {selected?.icon}
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            (!selected || selected.value === '') && 'text-ink-disabled',
          )}
        >
          {selected?.label ?? placeholder ?? ''}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-sub transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {open &&
        position &&
        layer &&
        createPortal(
          <div
            ref={list}
            className="fixed z-[70] flex flex-col border border-line bg-surface shadow-(--shadow-raised)"
            style={{
              left: position.left,
              width: position.width,
              top: position.top,
              bottom: position.bottom,
              maxHeight: LIST_MAX_HEIGHT,
            }}
          >
            {searchable && (
              <div className="relative border-b border-line p-2">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-4.5 size-4 -translate-y-1/2 text-ink-sub"
                />
                <input
                  ref={search}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder="検索"
                  aria-label="検索"
                  aria-controls={listId}
                  className="h-8 w-full border border-line bg-canvas pr-2 pl-8 text-sm focus:border-main-focus focus:outline-none"
                />
              </div>
            )}
            <ul
              id={listId}
              role="listbox"
              aria-labelledby={triggerId}
              className="min-h-0 flex-1 overflow-y-auto py-1"
            >
              {shown.length === 0 && (
                <li className="px-3 py-2.5 text-sm text-ink-sub">見つかりません</li>
              )}
              {shown.map((option, index) => {
                const isSelected = option.value === value;
                return (
                  <li
                    key={option.value || '__empty'}
                    role="option"
                    aria-selected={isSelected}
                    data-index={index}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(option)}
                    className={cn(
                      'flex min-h-9 cursor-pointer items-center gap-2 px-3 py-1.5 text-sm',
                      index === active && 'bg-hover',
                      isSelected ? 'font-bold text-ink' : 'text-ink',
                      option.value === '' && 'text-ink-sub',
                    )}
                  >
                    {option.icon}
                    <span className="min-w-0 flex-1">{option.label}</span>
                    {isSelected && (
                      <Check aria-hidden="true" className="size-4 shrink-0 text-schedule" />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>,
          layer,
        )}
    </div>
  );
}
