// apps/api/src/domain/shared/storage.interface.ts
// Abstraction for cloud storage operations. R2 implementation lives in infrastructure/.
// Future modules (Reports, Export) inject the same IStorageService token.

export interface StorageUploadResult {
  key: string;
  size: number;
  etag?: string;
}

export interface PresignedUrlResult {
  url: string;
  expiresAt: Date;
}

export interface IStorageService {
  /**
   * Upload a small file (< 5MB) using PutObject.
   * For larger files, use uploadMultipart.
   */
  upload(key: string, data: Buffer, metadata?: Record<string, string>): Promise<StorageUploadResult>;

  /**
   * Upload a large file (>= 5MB) using S3 multipart upload.
   * Chunks are uploaded sequentially with the given chunkSize (default 5MB).
   */
  uploadMultipart(key: string, data: Buffer, metadata?: Record<string, string>, chunkSize?: number): Promise<StorageUploadResult>;

  /**
   * Generate a presigned URL for temporary read access.
   * @param key R2 object key
   * @param ttlMinutes Time-to-live in minutes (default 15)
   */
  getPresignedUrl(key: string, ttlMinutes?: number): Promise<PresignedUrlResult>;

  /**
   * Delete an object from R2.
   */
  delete(key: string): Promise<void>;
}