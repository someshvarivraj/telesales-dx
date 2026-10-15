import type { RequestHandler } from 'express';
import multer from 'multer';
import { FileTooLargeError, ValidationError } from './errors/AppError.js';

/** Upload limit per file. Lists of ~1,000 rows and handover PDFs are far below this. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const memory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 10 },
});

function mapMulterErrors(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    handler(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        next(
          error.code === 'LIMIT_FILE_SIZE'
            ? new FileTooLargeError()
            : new ValidationError({ file: [error.code] }),
        );
        return;
      }
      next(error);
    });
  };
}

/** Accepts multipart uploads in field `files` (max 10). Files stay in memory until stored. */
export const uploadFiles = mapMulterErrors(memory.array('files', 10));
export const uploadSingleFile = mapMulterErrors(memory.single('file'));
