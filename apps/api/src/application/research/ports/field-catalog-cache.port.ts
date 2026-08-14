// apps/api/src/application/research/ports/field-catalog-cache.port.ts
// Cache abstraction for the field discovery catalog (design AD-3).
// Production impl: RedisFieldCatalogCache (ioredis, TTL 1h). Tests / single-
// instance deployments: InMemoryFieldCatalogCache (honours the same TTL
// contract). The domain/application layer depends only on this port so the
// infra choice is swappable without touching FieldDiscoveryService.

export interface CachedCatalog {
  entries: import('@medicore/contracts').FieldCatalogEntry[];
  totalPatients?: number;
  generatedAt: string; // ISO timestamp
}

export interface FieldCatalogCachePort {
  /** Read the cached catalog for an org. Returns null on miss/expiry. */
  get(organizationId: string): Promise<CachedCatalog | null>;
  /** Store the catalog; ttlSeconds defaults to 1h (design AD-3). */
  set(organizationId: string, catalog: CachedCatalog, ttlSeconds?: number): Promise<void>;
  /** Invalidate the cached catalog — called on import completion (AD-3). */
  invalidate(organizationId: string): Promise<void>;
}
