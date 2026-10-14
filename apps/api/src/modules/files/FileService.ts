import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import type { FileDto } from '@telesales/shared';
import type { FileStorage } from '../../domain/storage/FileStorage.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { NotFoundError } from '../../http/errors/AppError.js';
import { iso } from '../../http/mappers.js';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface StoredFileRecord {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: Date;
}

export function toFileDto(file: StoredFileRecord): FileDto {
  return {
    id: file.id,
    originalName: file.originalName,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes,
    createdAt: iso(file.createdAt),
  };
}

export function sha256Of(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Browsers send Latin-1 decoded names for multipart uploads; restore UTF-8 (日本語のファイル名). */
function decodeFileName(name: string): string {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('�') ? name : decoded;
}

/**
 * Uploaded files are stored under random keys and only served through the
 * authenticated API (spec §11: no file opens by URL without login).
 */
export class FileService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: FileStorage,
  ) {}

  async store(file: UploadedFile, uploadedById: string): Promise<StoredFileRecord> {
    return this.save(file, decodeFileName(file.originalname), uploadedById);
  }

  /** Files the system creates itself (e.g. the daily report attachment). */
  storeGenerated(file: UploadedFile, uploadedById: string | null): Promise<StoredFileRecord> {
    return this.save(file, file.originalname, uploadedById);
  }

  private async save(
    file: UploadedFile,
    name: string,
    uploadedById: string | null,
  ): Promise<StoredFileRecord> {
    const originalName = name.slice(0, 255);
    const extension = path
      .extname(originalName)
      .toLowerCase()
      .replace(/[^.a-z0-9]/g, '');
    const now = new Date();
    const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}${extension}`;
    await this.storage.put(key, file.buffer);
    return this.prisma.storedFile.create({
      data: {
        storageKey: key,
        originalName,
        contentType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
        sha256: sha256Of(file.buffer),
        uploadedById,
      },
    });
  }

  async read(id: string): Promise<{ record: StoredFileRecord; content: Buffer }> {
    const record = await this.prisma.storedFile.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundError();
    }
    return { record, content: await this.storage.get(record.storageKey) };
  }
}
