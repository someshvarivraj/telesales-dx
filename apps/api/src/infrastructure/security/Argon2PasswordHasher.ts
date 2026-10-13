import argon2 from 'argon2';
import type { PasswordHasher } from '../../domain/security/PasswordHasher.js';

/** argon2id with OWASP-recommended parameters (19 MiB, t=2, p=1). */
export class Argon2PasswordHasher implements PasswordHasher {
  private static readonly options = {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  } as const;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, Argon2PasswordHasher.options);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}
