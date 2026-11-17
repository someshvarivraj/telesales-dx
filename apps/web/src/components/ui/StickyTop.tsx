import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

/**
 * The page's fixed top, shared through the layout: the section header registers its slot, and
 * a page inside the section can put extra things there (e.g. a list's search filters).
 */
const SlotContext = createContext<{
  slot: HTMLElement | null;
  setSlot: (element: HTMLElement | null) => void;
} | null>(null);

/** Wrap the page area once (AppLayout), so headers and pages can share the fixed top. */
export function StickyTopProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return <SlotContext.Provider value={{ slot, setSlot }}>{children}</SlotContext.Provider>;
}

/**
 * A screen's top — title, tabs, the buttons people use — stays in place while the page
 * scrolls (request 11/17), so it is always clear where you are and what you can do. On phones
 * it sits under the top bar. It covers the page's own top padding, so it lines up with the
 * edge of the screen when it sticks.
 */
export function StickyTop({ children, className }: { children: ReactNode; className?: string }) {
  const shared = useContext(SlotContext);
  const box = useRef<HTMLDivElement>(null);
  // Where the fixed top ends, so table headers and calendars can stick right under it.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const root = document.documentElement;
    const measure = () => {
      const top = parseFloat(getComputedStyle(el).top) || 0;
      root.style.setProperty('--page-top', `${top + el.offsetHeight}px`);
    };
    measure();
    // Missing in some environments (the test runner): then it is measured on resize only.
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      root.style.removeProperty('--page-top');
    };
  }, []);
  return (
    <div
      ref={box}
      className={cn(
        'sticky-top sticky top-13 z-20 -mt-5 bg-canvas pt-5 md:top-11 md:-mt-4 md:pt-4',
        className,
      )}
    >
      {children}
      <div ref={shared?.setSlot} />
    </div>
  );
}

/**
 * Puts its children into the section's fixed top (under the tabs), so a list's search filters
 * stay visible while the results scroll. Without a fixed top on the page, renders in place.
 */
export function StickyExtra({ children }: { children: ReactNode }) {
  const slot = useContext(SlotContext)?.slot;
  return slot ? createPortal(<div className="pb-4">{children}</div>, slot) : <>{children}</>;
}
