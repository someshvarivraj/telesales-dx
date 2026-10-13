import { randomInt } from 'node:crypto';
import { PASSWORD_MIN_LENGTH } from '@telesales/shared';

/** Readable alphabet without look-alike characters (0/O, 1/l/I). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export class TemporaryPasswordGenerator {
  constructor(private readonly length = Math.max(PASSWORD_MIN_LENGTH, 16)) {}

  generate(): string {
    return Array.from({ length: this.length }, () =>
      ALPHABET.charAt(randomInt(ALPHABET.length)),
    ).join('');
  }
}
