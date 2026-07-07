// apps/api/src/infrastructure/storage/r2-storage.service.ts
// R2 (Cloudflare S3-compatible) implementation of IStorageService.
// Uses @aws-sdk/client-s3 for PutObject/DeleteObject and @aws-sdk/s3-request-presigner for presigned URLs.
// Files >= 5MB use multipart upload; smaller files use single PutObject.

import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import type { IStorageService, StorageUploadResult, PresignedUrlResult } from '@/domain/shared/storage.interface';

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

@Injectable()
export class R2StorageService implements IStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.client = new S3Client({
      endpoint: process.env.R2_ENDPOINT,
      region: 'auto',
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      },
    });
    this.bucket = process.env.R2_BUCKET ?? 'medicore-storage';
  }

  async upload(key: string, data: Buffer, metadata?: Record<string, string>): Promise<StorageUploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: metadata?.['contentType'],
      Metadata: metadata,
    });

    const result = await this.client.send(command);

    return {
      key,
      size: data.length,
      etag: result.ETag ?? undefined,
    };
  }

  async uploadMultipart(key: string, data: Buffer, metadata?: Record<string, string>, chunkSize: number = DEFAULT_CHUNK_SIZE): Promise<StorageUploadResult> {
    // Initiate multipart upload
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: metadata?.['contentType'],
      Metadata: metadata,
    });

    const createResult = await this.client.send(createCommand);
    const uploadId = createResult.UploadId!;

    // Upload parts sequentially
    const parts: { ETag?: string; PartNumber: number }[] = [];
    let partNumber = 1;

    for (let offset = 0; offset < data.length; offset += chunkSize) {
      const chunk = data.subarray(offset, offset + chunkSize);

      const uploadPartCommand = new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        PartNumber: partNumber,
        UploadId: uploadId,
        Body: chunk,
      });

      const partResult = await this.client.send(uploadPartCommand);
      parts.push({
        ETag: partResult.ETag,
        PartNumber: partNumber,
      });
      partNumber++;
    }

    // Complete multipart upload
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((p) => ({
          ETag: p.ETag,
          PartNumber: p.PartNumber,
        })),
      },
    });

    const completeResult = await this.client.send(completeCommand);

    return {
      key,
      size: data.length,
      etag: completeResult.ETag ?? undefined,
    };
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
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }
}