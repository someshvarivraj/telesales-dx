/** Where uploaded bytes live. Local disk in development; S3 in AWS. */
export interface FileStorage {
  put(key: string, content: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
}
