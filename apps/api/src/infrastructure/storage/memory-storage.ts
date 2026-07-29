// apps/api/src/infrastructure/storage/memory-storage.ts
// In-memory StoragePort double (mock R2). Deterministic signed URLs shaped
// like `memory://<org>/<key>?token=...&expires=...`. Used by dev + tests so the
// PDF pipeline is verifiable without network access.

import { Injectable } from '@nestjs/common';
import type { StoragePort, UploadedFile } from './storage.port';

const DEFAULT_TTL = 24 * 3600; // 24h (design)

@Injectable()
export class MemoryStorageService implements StoragePort {
  readonly files = new Map<string, { body: Buffer; contentType: string }>();

  async upload(
    organizationId: string,
    key: string,
    body: Buffer,
    contentType: string,
    ttlSeconds = DEFAULT_TTL,
  ): Promise<UploadedFile> {
    const fullKey = `${organizationId}/${key}`;
    this.files.set(fullKey, { body, contentType });
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    return {
      key: fullKey,
      url: `memory://${organizationId}/${key}?token=mem&expires=${expires}`,
      size: body.byteLength,
      contentType,
    };
  }
}