// apps/api/src/infrastructure/storage/s3-private-storage.service.ts
// Private S3 implementation for sensitive PDFs (spec §5).
// Unlike R2 (used for DICOM), this uses AWS S3 with private ACL — no public exposure.
// Follows the same IStorageService contract as R2StorageService.

import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { IStorageService, StorageUploadResult, PresignedUrlResult } from '@/domain/shared/storage.interface';

@Injectable()
export class S3PrivateStorageService implements IStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.client = new S3Client({
      endpoint: process.env.S3_PRIVATE_ENDPOINT,
      region: process.env.S3_PRIVATE_REGION ?? 'eu-west-1',
      credentials: {
        accessKeyId: process.env.S3_PRIVATE_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.S3_PRIVATE_SECRET_ACCESS_KEY ?? '',
      },
      forcePathStyle: true, // Required for MinIO and some S3-compatible stores
    });
    this.bucket = process.env.S3_PRIVATE_BUCKET ?? 'medicore-private';
  }

  async upload(key: string, data: Buffer, metadata?: Record<string, string>): Promise<StorageUploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: metadata?.['contentType'],
      Metadata: metadata,
      // Private by default — no public-read ACL
    });

    const result = await this.client.send(command);
    return { key, size: data.length, etag: result.ETag ?? undefined };
  }

  async uploadMultipart(
    key: string,
    data: Buffer,
    _metadata?: Record<string, string>,
    _chunkSize?: number,
  ): Promise<StorageUploadResult> {
    // For simplicity, delegate to single upload. Large PDFs can be handled
    // by the caller splitting into chunks. This keeps the contract identical.
    return this.upload(key, data, _metadata);
  }

  async getPresignedUrl(key: string, ttlMinutes: number = 15): Promise<PresignedUrlResult> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn: ttlMinutes * 60 });
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    return { url, expiresAt };
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
    await this.client.send(command);
  }
}
