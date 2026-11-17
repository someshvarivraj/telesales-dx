import type { Response } from 'express';

/**
 * Types that may be shown in the browser (11/18 audit). SVG is not among them: it can carry
 * script. Everything else is always a download.
 */
const INLINE_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

/**
 * Types sent as they are; any other type (the uploader's browser chose it) goes out as
 * application/octet-stream, so an uploaded .html, .svg or .js can never be run from our origin.
 */
const KNOWN_TYPES = new Set([
  ...INLINE_TYPES,
  'text/csv',
  'text/plain',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/msword',
]);

/** Whether a stored file may be shown in the browser instead of downloaded. */
export function canShowInline(contentType: string): boolean {
  return INLINE_TYPES.has(contentType.split(';')[0]?.trim().toLowerCase() ?? '');
}

/**
 * Sends a stored file as a download, or inline for PDFs and plain images when asked. Never
 * cached publicly, never sniffed, and sandboxed so no file can run script on this site.
 */
export function sendFile(
  res: Response,
  file: { originalName: string; contentType: string },
  content: Buffer,
  options: { inline?: boolean } = {},
): void {
  const ascii = file.originalName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const type = file.contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  const inline = Boolean(options.inline) && INLINE_TYPES.has(type);
  const disposition = inline ? 'inline' : 'attachment';
  res.setHeader('Content-Type', KNOWN_TYPES.has(type) ? type : 'application/octet-stream');
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:");
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
  );
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(content);
}

export function uploadedFiles(files: unknown): Express.Multer.File[] {
  return Array.isArray(files) ? (files as Express.Multer.File[]) : [];
}
