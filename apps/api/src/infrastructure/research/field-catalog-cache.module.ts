// apps/api/src/infrastructure/research/field-catalog-cache.module.ts
// Shared provider for the FieldCatalogCachePort token (design AD-3). Imported
// by both the import queue (to invalidate the catalog on import completion) and
// the research module (FieldDiscoveryService reads/writes the catalog) so a
// single cache instance is shared across both concerns.

import { Module } from '@nestjs/common';
import { InMemoryFieldCatalogCache } from './in-memory-field-catalog-cache';

@Module({
  providers: [{ provide: 'FieldCatalogCachePort', useClass: InMemoryFieldCatalogCache }],
  exports: ['FieldCatalogCachePort'],
})
export class FieldCatalogCacheModule {}