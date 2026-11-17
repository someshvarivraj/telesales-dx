import { Check, Globe, Palette } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { type Theme, THEMES, useTheme } from '@/components/brand/theme';
import { cn } from '@/components/ui/cn';
import { type Language, switchLanguage, useLanguage } from '@/i18n/english/language';

/** A small icon button with a menu under it (closes on a click outside or Esc). */
function IconMenu({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div ref={box} className="relative" data-no-translate>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex size-8 cursor-pointer items-center justify-center text-ink-sub hover:bg-hover hover:text-ink',
          open && 'bg-hover text-ink',
        )}
      >
        {icon}
      </button>
      {open && (
        <div
          role="menu"
          className="pop-in absolute top-full right-0 z-50 mt-1 min-w-44 border border-line bg-surface py-1 shadow-(--shadow-popover)"
          style={{ ['--pop-origin' as string]: 'top right' }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-hover',
        on ? 'font-bold text-ink' : 'text-ink-sub',
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">
        {on && <Check aria-hidden="true" className="size-4 text-main" />}
      </span>
      {children}
    </button>
  );
}

/** Swatch for each theme: its main colour on its page colour. */
const SWATCH: Record<Theme, [string, string]> = {
  teams: ['#5b5fc7', '#f5f5f5'],
  standard: ['#c2410c', '#f7f8fa'],
  sakura: ['#be185d', '#fdf7fa'],
  eyecare: ['#3d7458', '#efe9dc'],
  dark: ['#d4561c', '#171c23'],
};

/** Language as a small globe icon with a short menu (11/17). */
export function LanguageMenu() {
  const language = useLanguage();
  const languages: { value: Language; label: string }[] = [
    { value: 'ja', label: '日本語' },
    { value: 'en', label: 'English' },
  ];
  return (
    <IconMenu label="言語 / Language" icon={<Globe aria-hidden="true" className="size-4.5" />}>
      {(close) =>
        languages.map((option) => (
          <MenuItem
            key={option.value}
            on={language === option.value}
            onClick={() => {
              switchLanguage(option.value);
              close();
            }}
          >
            {option.label}
          </MenuItem>
        ))
      }
    </IconMenu>
  );
}

/** Theme as a small palette icon with a short menu and a swatch for each (11/17). */
export function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  return (
    <IconMenu label="テーマ" icon={<Palette aria-hidden="true" className="size-4.5" />}>
      {(close) =>
        THEMES.map((option) => {
          const [main, page] = SWATCH[option.value];
          return (
            <MenuItem
              key={option.value}
              on={theme === option.value}
              onClick={() => {
                setTheme(option.value);
                close();
              }}
            >
              <span
                aria-hidden="true"
                className="size-3.5 shrink-0 border border-line"
                style={{ background: `linear-gradient(135deg, ${main} 50%, ${page} 50%)` }}
              />
              {option.label}
            </MenuItem>
          );
        })
      }
    </IconMenu>
  );
}

/**
 * Language and theme as two small icons at the top right (request 11/17): no long boxes with
 * names, just the symbols, each opening a short menu.
 */
export function TopBarMenus() {
  return (
    <div className="flex items-center gap-0.5">
      <LanguageMenu />
      <ThemeMenu />
    </div>
  );
}
