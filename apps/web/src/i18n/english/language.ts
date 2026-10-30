import { useSyncExternalStore } from 'react';
import { ScreenTranslator } from './ScreenTranslator';

export type Language = 'ja' | 'en';

const STORAGE_KEY = 'telesales.language';

/** The chosen screen language (per browser). Japanese unless English was picked. */
export function currentLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ja';
  } catch {
    return 'ja';
  }
}

let translator: ScreenTranslator | null = null;
const listeners = new Set<() => void>();

/** The language shown now; every switch on the page follows it. */
export function useLanguage(): Language {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => shown,
  );
}
let shown: Language = 'ja';
let japaneseTitle = '';
let screenRoot: HTMLElement | null = null;

/**
 * Saves the choice and switches the screen in place — no reload, so what is open or being
 * typed stays as it is (feedback 10/30).
 */
export function switchLanguage(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage blocked (private window): the switch lasts for this page only.
  }
  show(language);
}

/** Called once at start-up, before the app renders. */
export function applyLanguage(root: HTMLElement): void {
  screenRoot = root;
  show(currentLanguage());
}

function show(language: Language): void {
  shown = language;
  listeners.forEach((listener) => listener());
  document.documentElement.lang = language;
  if (language === 'en' && !translator && screenRoot) {
    japaneseTitle = document.title;
    translator = new ScreenTranslator();
    document.title = translator.translate(document.title);
    translator.start(screenRoot);
  } else if (language === 'ja' && translator) {
    translator.restore();
    translator = null;
    document.title = japaneseTitle;
  }
}
