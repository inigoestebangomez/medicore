// apps/api/src/application/import/services/in-memory-parsed-file-cache.ts
// Default IParsedFileCache. Single-instance MVP. Keys are scoped by
// (batchId, organizationId) so one org cannot read another org's parsed file.

import { Injectable } from '@nestjs/common';
import type { ParsedFile } from '@medicore/contracts';
import type { IParsedFileCache } from '../ports/parsed-file-cache.port';

@Injectable()
export class InMemoryParsedFileCache implements IParsedFileCache {
  private readonly store = new Map<string, ParsedFile>();

  private key(batchId: string, organizationId: string): string {
    return `${organizationId}:${batchId}`;
  }

  async set(batchId: string, organizationId: string, file: ParsedFile): Promise<void> {
    this.store.set(this.key(batchId, organizationId), file);
  }

  async get(batchId: string, organizationId: string): Promise<ParsedFile | null> {
    return this.store.get(this.key(batchId, organizationId)) ?? null;
  }

  async delete(batchId: string, organizationId: string): Promise<void> {
    this.store.delete(this.key(batchId, organizationId));
  }
}
