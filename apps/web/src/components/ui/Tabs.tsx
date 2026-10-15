import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { cn } from './cn';

export interface TabItem {
  to: string;
  label: string;
  /** Count shown next to the label, e.g. open requests. */
  count?: number;
  end?: boolean;
}

/**
 * Route-based tabs in one bar. When they do not all fit, ‹ › buttons appear at the
 * ends with a fade, so it is clear there are more; the current tab is scrolled into
 * view and the mouse wheel scrolls sideways.
 */
export function Tabs({ items }: { items: readonly TabItem[] }) {
  const scroller = useRef<HTMLUListElement>(null);
  const location = useLocation();
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    setEdges({
      left: element.scrollLeft > 2,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // A vertical wheel moves the tabs sideways (only while there is somewhere to go).
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (element.scrollWidth <= element.clientWidth) return;
      event.preventDefault();
      element.scrollLeft += event.deltaY;
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      observer.disconnect();
      element.removeEventListener('wheel', wheel);
    };
  }, [measure]);

  // Bring the current tab into view when the page changes.
  useEffect(() => {
    const element = scroller.current;
    const current = element?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!element || !current) return;
    const left = current.offsetLeft - element.offsetLeft;
    if (
      left < element.scrollLeft ||
      left + current.offsetWidth > element.scrollLeft + element.clientWidth
    ) {
      element.scrollTo({ left: left - 40 });
    }
    measure();
  }, [location.pathname, measure]);

  const page = (direction: -1 | 1) => {
    const element = scroller.current;
    if (!element) return;
    element.scrollBy({ left: direction * element.clientWidth * 0.7, behavior: 'smooth' });
  };

  return (
    <nav className="relative mb-6 flex items-stretch border border-line bg-surface shadow-(--shadow-card)">
      <ArrowButton side="left" visible={edges.left} onClick={() => page(-1)} />
      <ul
        ref={scroller}
        onScroll={measure}
        className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto px-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <li key={item.to} className="shrink-0">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'relative flex h-11 items-center gap-2 px-3.5 text-sm whitespace-nowrap transition-colors',
                  'focus-visible:outline-2 focus-visible:-outline-offset-2',
                  'after:absolute after:inset-x-2 after:bottom-0 after:h-[3px]',
                  isActive
                    ? 'font-bold text-ink after:bg-main'
                    : 'font-medium text-ink-sub hover:bg-hover hover:text-ink',
                )
              }
            >
              {item.label}
              {item.count !== undefined && item.count > 0 && (
                <span className="min-w-5 rounded-full! bg-danger px-1.5 text-center text-xs leading-5 font-bold text-white">
                  {item.count}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      <ArrowButton side="right" visible={edges.right} onClick={() => page(1)} />
    </nav>
  );
}

function ArrowButton(props: { side: 'left' | 'right'; visible: boolean; onClick: () => void }) {
  const Icon = props.side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-y-0 z-10 flex items-center transition-opacity duration-150',
        props.side === 'left'
          ? 'left-0 bg-linear-to-r from-surface from-60% to-transparent pr-6'
          : 'right-0 bg-linear-to-l from-surface from-60% to-transparent pl-6',
        props.visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={props.side === 'left' ? '前のタブを表示' : '次のタブを表示'}
        onClick={props.onClick}
        disabled={!props.visible}
        className={cn(
          'flex h-full w-9 cursor-pointer items-center justify-center text-ink-sub hover:bg-hover hover:text-ink',
          props.side === 'left' ? 'border-r border-line' : 'border-l border-line',
          props.visible && 'pointer-events-auto',
        )}
      >
        <Icon aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}
