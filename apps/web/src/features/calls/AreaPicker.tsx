import { areaLabel, type SalesAreaOption, type SalesAreaPick } from '@telesales/shared';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, MapPin, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui/cn';
import { apiClient } from '@/lib/api/ApiClient';

/** The areas of today's 営業担当表 (every prefecture, its cities and the reps there). */
export function useSalesAreas() {
  return useQuery({
    queryKey: ['sales-areas'],
    queryFn: ({ signal }) => apiClient.get<SalesAreaOption[]>('/companies/sales-areas', signal),
    staleTime: 5 * 60_000,
  });
}

const same = (a: SalesAreaPick | null, b: SalesAreaPick | null) =>
  a?.prefecture === b?.prefecture && (a?.city ?? null) === (b?.city ?? null);

/**
 * Pick one place from the 営業担当表 (11/17): a whole prefecture or one city or ward. The reps and
 * the companies shown follow it. The list is the table's own, so new areas appear by themselves.
 */
export function AreaPicker({
  area,
  onArea,
  className,
}: {
  area: SalesAreaPick | null;
  onArea: (area: SalesAreaPick | null) => void;
  className?: string;
}) {
  const areas = useSalesAreas();
  const [open, setOpen] = useState(false);
  const [needle, setNeedle] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', escape);
    };
  }, [open]);

  const pick = (next: SalesAreaPick | null) => {
    onArea(next);
    setOpen(false);
    setNeedle('');
  };
  const word = needle.trim();
  const options = (areas.data ?? [])
    .map((option) => ({
      ...option,
      cities: option.cities.filter(
        (city) => !word || city.city.includes(word) || option.prefecture.includes(word),
      ),
    }))
    .filter((option) => !word || option.prefecture.includes(word) || option.cities.length > 0);

  const row = (active: boolean, nested = false) =>
    cn(
      'flex w-full cursor-pointer items-center gap-2 py-1.5 pr-3 text-left text-sm hover:bg-hover',
      nested ? 'pl-8' : 'pl-3 font-bold',
      active && 'bg-main-soft text-main',
    );

  return (
    <div ref={box} className={cn('relative', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-8 max-w-64 cursor-pointer items-center gap-1.5 border px-2.5 text-sm transition-colors',
          area
            ? 'border-main bg-main-soft font-bold text-main'
            : 'border-line-strong bg-surface text-ink hover:bg-hover',
        )}
      >
        <MapPin aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{area ? areaLabel(area) : 'エリア：すべて'}</span>
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 opacity-70" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 flex max-h-[min(28rem,70vh)] w-72 flex-col border border-line bg-surface shadow-(--shadow-raised)">
          <label className="flex shrink-0 items-center gap-2 border-b border-line px-3">
            <Search aria-hidden="true" className="size-4 text-ink-sub" />
            <input
              autoFocus
              value={needle}
              onChange={(event) => setNeedle(event.target.value)}
              placeholder="都道府県・市区町村で探す"
              aria-label="エリアを探す"
              className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
          <ul role="listbox" aria-label="エリア" className="min-h-0 flex-1 overflow-y-auto py-1">
            <li>
              <button type="button" onClick={() => pick(null)} className={row(area === null)}>
                すべてのエリア
                {area === null && <Check aria-hidden="true" className="ml-auto size-4" />}
              </button>
            </li>
            {areas.isPending && <li className="px-3 py-2 text-xs text-ink-sub">読み込み中…</li>}
            {!areas.isPending && options.length === 0 && (
              <li className="px-3 py-2 text-xs text-ink-sub">
                {word ? '見つかりません。' : '営業担当表にエリアがありません。'}
              </li>
            )}
            {options.map((option) => {
              const whole = { prefecture: option.prefecture, city: null };
              return (
                <li key={option.prefecture}>
                  <button
                    type="button"
                    onClick={() => pick(whole)}
                    className={row(same(area, whole))}
                  >
                    {option.prefecture}
                    <span className="ml-auto text-[11px] font-normal text-ink-sub">
                      営業{option.repIds.length}人
                    </span>
                    {same(area, whole) && <Check aria-hidden="true" className="size-4" />}
                  </button>
                  {option.cities.map((city) => {
                    const place = { prefecture: option.prefecture, city: city.city };
                    return (
                      <button
                        key={city.city}
                        type="button"
                        onClick={() => pick(place)}
                        className={row(same(area, place), true)}
                      >
                        <span className="truncate">{city.city}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-ink-sub">
                          {city.repIds.length}人
                        </span>
                        {same(area, place) && <Check aria-hidden="true" className="size-4" />}
                      </button>
                    );
                  })}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
