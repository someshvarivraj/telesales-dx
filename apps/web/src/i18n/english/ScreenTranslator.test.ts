import { describe, expect, it } from 'vitest';
import { ScreenTranslator } from './ScreenTranslator';

describe('ScreenTranslator', () => {
  const translator = new ScreenTranslator();

  it('translates known screen text and keeps the surrounding spaces', () => {
    expect(translator.translate('ログアウト')).toBe('Log out');
    expect(translator.translate(' 保存する ')).toBe(' Save ');
  });

  it('fills values into patterns and translates the values too', () => {
    expect(translator.translate('今日やることが 3 件あります。')).toBe(
      'You have 3 things to do today.',
    );
    expect(translator.translate('出勤（4人）')).toBe('Working (4)');
    expect(translator.translate('パスワードは12文字以上で入力してください。')).toBe(
      'The password needs at least 12 characters.',
    );
  });

  it('leaves names and other unknown text alone', () => {
    expect(translator.translate('株式会社モラブ')).toBe('株式会社モラブ');
    expect(translator.translate('V Someshvari')).toBe('V Someshvari');
  });

  it('translates the rendered page and text that appears later', async () => {
    document.body.innerHTML = '<main><h1>ログイン</h1><input placeholder="すべて"></main>';
    const live = new ScreenTranslator();
    live.start(document.body);
    expect(document.querySelector('h1')?.textContent).toBe('Log in');
    expect(document.querySelector('input')?.getAttribute('placeholder')).toBe('All');
    const p = document.createElement('p');
    p.textContent = 'お知らせ';
    document.querySelector('main')?.append(p);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(p.textContent).toBe('Notifications');
    live.stop();
  });

  it('puts the Japanese back when switching back, without a reload (10/30)', () => {
    document.body.innerHTML =
      '<main><h1>ログアウト</h1><input placeholder="すべて" value="入力中の文字"></main>';
    const live = new ScreenTranslator();
    live.start(document.body);
    expect(document.querySelector('h1')?.textContent).toBe('Log out');
    live.restore();
    expect(document.querySelector('h1')?.textContent).toBe('ログアウト');
    expect(document.querySelector('input')?.getAttribute('placeholder')).toBe('すべて');
    expect(document.querySelector('input')?.value).toBe('入力中の文字');
  });
});
