// apps/api/src/infrastructure/storage/storage.port.ts
// Abstraction over the R2/S3-compatible object store used by the export-v2
// pipeline to persist rendered PDFs and return time-limited signed URLs.
// Production: R2StorageService (Cloudflare R2 SDK). Tests / dev:
// MemoryStorageService (no network, deterministic URLs).

export interface UploadedFile {
  key: string;
  url: string; // signed URL (short TTL, e.g. 24h)
  size: number;
  contentType: string;
}

export interface StoragePort {
  upload(
    organizationId: string,
    key: string,
    body: Buffer,
    contentType: string,
    ttlSeconds?: number,
  ): Promise<UploadedFile>;
}