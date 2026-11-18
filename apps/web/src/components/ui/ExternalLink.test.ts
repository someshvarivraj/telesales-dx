import { describe, expect, it } from 'vitest';
import { webUrlOf } from './ExternalLink';

describe('webUrlOf (stored addresses as links, 11/18 audit)', () => {
  it('keeps http and https addresses', () => {
    expect(webUrlOf('https://example.co.jp/a?b=1')).toBe('https://example.co.jp/a?b=1');
    expect(webUrlOf(' http://example.com ')).toBe('http://example.com');
  });
  it('adds https:// to a bare domain', () => {
    expect(webUrlOf('www.example.co.jp')).toBe('https://www.example.co.jp');
    expect(webUrlOf('example.com/recruit')).toBe('https://example.com/recruit');
  });
  it('never links other schemes or plain text', () => {
    expect(webUrlOf('javascript:alert(1)')).toBeNull();
    expect(webUrlOf('JavaScript:alert(1)')).toBeNull();
    expect(webUrlOf('data:text/html,<script>1</script>')).toBeNull();
    expect(webUrlOf('vbscript:msgbox')).toBeNull();
    expect(webUrlOf('ホームページなし')).toBeNull();
    expect(webUrlOf('see website')).toBeNull();
    expect(webUrlOf('')).toBeNull();
    expect(webUrlOf(null)).toBeNull();
  });
});
