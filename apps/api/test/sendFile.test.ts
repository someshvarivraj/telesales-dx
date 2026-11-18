import type { Response } from 'express';
import { describe, expect, it } from 'vitest';
import { canShowInline, sendFile } from '../src/http/sendFile.js';

function fakeResponse() {
  const headers: Record<string, string> = {};
  let body: unknown;
  const res = {
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    },
    send: (content: unknown) => {
      body = content;
    },
  } as unknown as Response;
  return { res, headers, body: () => body };
}

describe('sendFile (stored files, 11/18 audit)', () => {
  it('shows PDFs and plain images inline when asked', () => {
    const { res, headers } = fakeResponse();
    sendFile(res, { originalName: 'a.pdf', contentType: 'application/pdf' }, Buffer.from(''), {
      inline: true,
    });
    expect(headers['content-type']).toBe('application/pdf');
    expect(headers['content-disposition']).toMatch(/^inline;/);
  });

  it('never shows SVG inline: it can carry script', () => {
    expect(canShowInline('image/svg+xml')).toBe(false);
    const { res, headers } = fakeResponse();
    sendFile(res, { originalName: 'x.svg', contentType: 'image/svg+xml' }, Buffer.from(''), {
      inline: true,
    });
    expect(headers['content-disposition']).toMatch(/^attachment;/);
    expect(headers['content-type']).toBe('application/octet-stream');
  });

  it('sends unknown types (html, js) as plain downloads', () => {
    for (const contentType of ['text/html', 'application/javascript', 'text/javascript']) {
      const { res, headers } = fakeResponse();
      sendFile(res, { originalName: 'x', contentType }, Buffer.from(''), { inline: true });
      expect(headers['content-type']).toBe('application/octet-stream');
      expect(headers['content-disposition']).toMatch(/^attachment;/);
    }
  });

  it('is sandboxed, never sniffed and never cached publicly', () => {
    const { res, headers } = fakeResponse();
    sendFile(res, { originalName: 'リスト.xlsx', contentType: 'text/plain' }, Buffer.from(''));
    expect(headers['content-security-policy']).toContain('sandbox');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['cache-control']).toBe('private, no-store');
    expect(headers['content-disposition']).toContain("filename*=UTF-8''");
  });
});
