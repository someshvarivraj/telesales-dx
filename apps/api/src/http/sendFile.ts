import type { Response } from 'express';

/** Sends a stored file as a download (or inline for PDFs/images). Never cached publicly. */
export function sendFile(
  res: Response,
  file: { originalName: string; contentType: string },
  content: Buffer,
  options: { inline?: boolean } = {},
): void {
  const ascii = file.originalName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const disposition = options.inline ? 'inline' : 'attachment';
  res.setHeader('Content-Type', file.contentType);
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
