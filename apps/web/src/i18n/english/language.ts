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

/** Saves the choice and reloads, so every screen starts in the new language. */
export function switchLanguage(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage blocked (private window): the switch lasts for this page only.
  }
  window.location.reload();
}

/** Called once at start-up, before the app renders. */
export function applyLanguage(root: HTMLElement): void {
  const language = currentLanguage();
  document.documentElement.lang = language;
  if (language === 'en') {
    const translator = new ScreenTranslator();
    document.title = translator.translate(document.title);
    translator.start(root);
  }
}
