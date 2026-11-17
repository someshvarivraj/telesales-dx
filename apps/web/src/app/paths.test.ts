import { describe, expect, it } from 'vitest';
import { safeRedirectTarget } from './paths';

describe('safeRedirectTarget', () => {
  it('accepts in-app paths', () => {
    expect(safeRedirectTarget('/sales/schedule?week=2')).toBe('/sales/schedule?week=2');
  });

  it.each([
    null,
    '',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/\\/evil.example',
    '/\tevil',
    'javascript:alert(1)',
    '/login?redirect=/x',
  ])('rejects %s', (value) => {
    expect(safeRedirectTarget(value)).toBeNull();
  });
});
