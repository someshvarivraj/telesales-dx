import 'sakura-js/dist/sakura.min.css';
// `no-inline`: a file of its own, since the security policy refuses inline (data:) scripts.
import sakuraUrl from 'sakura-js/dist/sakura.min.js?url&no-inline';
import { useEffect, useId } from 'react';
import { cn } from '@/components/ui/cn';

interface SakuraInstance {
  stop(graceful?: boolean): void;
}

declare global {
  interface Window {
    Sakura?: new (selector: string, options?: object) => SakuraInstance;
  }
}

let loading: Promise<void> | null = null;

/**
 * sakura-js (npm, MIT) is a plain browser script, so it is loaded as a file from this site.
 * Called once at start-up: the maintenance overlay needs it when the server is already gone.
 */
export function preloadSakura(): Promise<void> {
  if (window.Sakura) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = sakuraUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error('sakura-js could not be loaded'));
    };
    document.head.append(script);
  });
  return loading;
}

const COLORS = [
  {
    gradientColorStart: 'rgba(255, 183, 197, 0.9)',
    gradientColorEnd: 'rgba(255, 197, 208, 0.9)',
    gradientColorDegree: 120,
  },
  {
    gradientColorStart: 'rgba(255, 189, 189)',
    gradientColorEnd: 'rgba(227, 170, 181)',
    gradientColorDegree: 120,
  },
  {
    gradientColorStart: 'rgba(212, 152, 163)',
    gradientColorEnd: 'rgba(242, 185, 196)',
    gradientColorDegree: 120,
  },
];

/**
 * Sakura petals drifting down behind the page (request 11/12: the sign-in screen and the
 * maintenance screen only). Never takes clicks; still for people who prefer reduced motion.
 */
export function SakuraPetals({ className }: { className?: string }) {
  const id = `sakura-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let petals: SakuraInstance | null = null;
    let cancelled = false;
    preloadSakura()
      .then(() => {
        if (cancelled || !window.Sakura || !document.getElementById(id)) return;
        petals = new window.Sakura(`#${id}`, {
          fallSpeed: 1.6,
          minSize: 9,
          maxSize: 15,
          delay: 320,
          colors: COLORS,
        });
      })
      .catch(() => {
        // The page works the same without petals.
      });
    return () => {
      cancelled = true;
      petals?.stop();
    };
  }, [id]);
  return (
    <div
      id={id}
      aria-hidden="true"
      className={cn('pointer-events-none fixed inset-0 overflow-hidden', className)}
    />
  );
}
