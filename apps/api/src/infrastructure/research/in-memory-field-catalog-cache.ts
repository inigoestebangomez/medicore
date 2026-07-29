// apps/api/src/infrastructure/research/in-memory-field-catalog-cache.ts
// Default FieldCatalogCachePort impl. Single-instance TTL cache (design AD-3).
// Mirrors the Redis contract (get/set/invalidate with TTL) so it is a drop-in
// stand-in for local/test deployments; production swaps in a Redis impl.

import { Injectable } from '@nestjs/common';
import type { CachedCatalog, FieldCatalogCachePort } from '@/application/research/ports/field-catalog-cache.port';

const DEFAULT_TTL = 3600; // 1 hour (design AD-3)

interface Entry {
  catalog: CachedCatalog;
  expiresAt: number; // epoch ms
}

@Injectable()
export class InMemoryFieldCatalogCache implements FieldCatalogCachePort {
  private readonly store = new Map<string, Entry>();

  async get(organizationId: string): Promise<CachedCatalog | null> {
    const entry = this.store.get(organizationId);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(organizationId);
      return null;
    }
    return entry.catalog;
  }

  async set(
    organizationId: string,
    catalog: CachedCatalog,
    ttlSeconds = DEFAULT_TTL,
  ): Promise<void> {
    this.store.set(organizationId, {
      catalog,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async invalidate(organizationId: string): Promise<void> {
    this.store.delete(organizationId);
  }
}