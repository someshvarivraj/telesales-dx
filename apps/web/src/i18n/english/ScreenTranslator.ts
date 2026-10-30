import { EXACT, PATTERNS } from './dictionary';

const JAPANESE = /[぀-ヿ㐀-鿿＀-￯]/;
const ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'] as const;
/** Elements whose text must stay as typed or sent (mail bodies, code). */
const SKIP = 'textarea, script, style, code, pre, [data-no-translate], [contenteditable="true"]';

interface CompiledPattern {
  regex: RegExp;
  output: string;
}

function compile(rawSource: string, output: string): CompiledPattern {
  // Screen text is matched with its spaces collapsed, so the patterns are too.
  const source = rawSource.replace(/\s+/g, ' ');
  const escaped = source
    .split(/\{\d\}/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('(.+?)');
  // Patterns name their holes {0}, {1}… in order; map capture n back to its number.
  const order = [...source.matchAll(/\{(\d)\}/g)].map((match) => Number(match[1]));
  const remapped = output.replace(/\{(\d)\}/g, (_, n: string) => `{${order.indexOf(Number(n))}}`);
  return { regex: new RegExp(`^${escaped}$`, 's'), output: remapped };
}

/**
 * Shows the Japanese screens in English for the team (temporary, see dictionary.ts).
 * Works on the rendered page: every text node and a few attributes are looked up in the
 * dictionary, and a MutationObserver keeps new and re-rendered text translated.
 */
export class ScreenTranslator {
  /** The most specific patterns (most fixed text) are tried first. */
  private readonly patterns = [...PATTERNS]
    .sort((a, b) => b[0].replace(/\{\d\}/g, '').length - a[0].replace(/\{\d\}/g, '').length)
    .map(([source, output]) => compile(source, output));
  /** Longer keys first, for words inside sentences the server builds. */
  private readonly words = Object.keys(EXACT)
    .filter((key) => key.length >= 3)
    .sort((a, b) => b.length - a.length);
  private readonly cache = new Map<string, string>();
  private observer: MutationObserver | null = null;
  /** What each changed text or attribute said in Japanese, to switch back without a reload. */
  private readonly texts = new Map<Text, { japanese: string; english: string }>();
  private readonly attributes = new Map<
    Element,
    Map<string, { japanese: string; english: string }>
  >();

  start(root: HTMLElement): void {
    this.translateTree(root);
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          this.translateText(mutation.target as Text);
        } else if (mutation.type === 'attributes') {
          this.translateAttribute(mutation.target as Element, mutation.attributeName ?? '');
        } else {
          mutation.addedNodes.forEach((node) => this.translateTree(node));
        }
      }
    });
    this.observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES],
    });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  /** Stops and puts the Japanese back wherever the English is still showing. */
  restore(): void {
    this.stop();
    for (const [node, text] of this.texts) {
      if (node.isConnected && node.data === text.english) node.data = text.japanese;
    }
    for (const [element, names] of this.attributes) {
      for (const [name, text] of names) {
        if (element.isConnected && element.getAttribute(name) === text.english) {
          element.setAttribute(name, text.japanese);
        }
      }
    }
    this.texts.clear();
    this.attributes.clear();
  }

  /** English for one piece of Japanese text, or the text itself when unknown. */
  translate(text: string): string {
    if (!JAPANESE.test(text)) {
      return text;
    }
    const cached = this.cache.get(text);
    if (cached !== undefined) {
      return cached;
    }
    const lead = /^\s*/.exec(text)?.[0] ?? '';
    const trail = /\s*$/.exec(text)?.[0] ?? '';
    const core = text.trim().replace(/\s+/g, ' ');
    const result = lead + this.translateCore(core, 0) + trail;
    this.cache.set(text, result);
    return result;
  }

  private translateCore(text: string, depth: number): string {
    const exact = EXACT[text];
    if (exact !== undefined) {
      return exact;
    }
    if (depth < 3) {
      for (const pattern of this.patterns) {
        const match = pattern.regex.exec(text);
        if (match) {
          return pattern.output.replace(/\{(\d)\}/g, (_, n: string) =>
            this.translateCore(match[Number(n) + 1] ?? '', depth + 1),
          );
        }
      }
    }
    // Sentences built from known words (e.g. notices from the server).
    let result = text;
    for (const word of this.words) {
      if (result.includes(word)) {
        result = result.split(word).join(` ${EXACT[word] ?? word} `);
      }
    }
    return result === text ? text : result.replace(/\s{2,}/g, ' ').trim();
  }

  private translateTree(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      this.translateText(node as Text);
      return;
    }
    if (!(node instanceof Element) || node.closest(SKIP)) {
      return;
    }
    ATTRIBUTES.forEach((name) => this.translateAttribute(node, name));
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let current = walker.nextNode(); current; current = walker.nextNode()) {
      if (current instanceof Element) {
        ATTRIBUTES.forEach((name) => this.translateAttribute(current as Element, name));
      } else {
        this.translateText(current as Text);
      }
    }
  }

  private translateText(node: Text): void {
    const value = node.data;
    if (!JAPANESE.test(value) || node.parentElement?.closest(SKIP)) {
      return;
    }
    const english = this.translate(value);
    if (english !== value) {
      this.texts.set(node, { japanese: value, english });
      node.data = english;
    }
  }

  private translateAttribute(element: Element, name: string): void {
    const value = element.getAttribute(name);
    if (!value || !JAPANESE.test(value) || element.closest(SKIP)) {
      return;
    }
    const english = this.translate(value);
    if (english !== value) {
      const names = this.attributes.get(element) ?? new Map();
      names.set(name, { japanese: value, english });
      this.attributes.set(element, names);
      element.setAttribute(name, english);
    }
  }
}
