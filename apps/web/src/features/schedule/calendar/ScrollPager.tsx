import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type RefObject, useEffect, useState } from 'react';
import { cn } from '@/components/ui/cn';

/**
 * ＜ ＞ under a calendar that is wider than the screen: moves one screen-width at a time
 * (request 10/29: ページごと移動). The scroll bars stay visible for finer moves.
 */
export function ScrollPager({
  target,
  stickyWidth = 0,
}: {
  target: RefObject<HTMLDivElement | null>;
  /** Width of the column that stays put (times or names), not counted as a page. */
  stickyWidth?: number;
}) {
  const [state, setState] = useState({ overflow: false, atStart: true, atEnd: false });

  useEffect(() => {
    const element = target.current;
    if (!element) return;
    const update = () =>
      setState({
        overflow: element.scrollWidth > element.clientWidth + 1,
        atStart: element.scrollLeft <= 1,
        atEnd: element.scrollLeft + element.clientWidth >= element.scrollWidth - 1,
      });
    update();
    element.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    if (element.firstElementChild) observer?.observe(element.firstElementChild);
    return () => {
      element.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, [target]);

  if (!state.overflow) return null;
  const page = (direction: -1 | 1) => {
    const element = target.current;
    if (!element) return;
    element.scrollBy({
      left: direction * Math.max(120, element.clientWidth - stickyWidth - 24),
      behavior: 'smooth',
    });
  };
  const button =
    'flex h-8 cursor-pointer items-center gap-1 border border-line bg-surface px-2.5 text-xs font-bold text-ink-sub hover:border-main hover:text-main disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="mt-1.5 flex justify-end gap-1.5">
      <button
        type="button"
        className={cn(button)}
        onClick={() => page(-1)}
        disabled={state.atStart}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        前のページ
      </button>
      <button type="button" className={cn(button)} onClick={() => page(1)} disabled={state.atEnd}>
        次のページ
        <ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
