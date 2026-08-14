// apps/api/src/application/import/ports/parsed-file-cache.port.ts
// Holds the parsed file (full rows) for the lifetime of an import batch.
//
// Per spec §3 / AD-6 the raw uploaded buffer is never persisted to the DB. The
// normalized row values needed for preview/resume are stored separately on the
// ImportBatch, while only explicitly-confirmed importedData JSONB is written to
// patients (BR-IMP-002). The cleaning (Stage 3), matching (Stage 4) and
// finalize (Stage 5) steps all
// need the full parsed rows, which can be large. This cache bridges the
// synchronous upload request and the background finalize job. Entries are
// purged on COMPLETED, FAILED or revert.
//
// The default implementation is in-memory (single-instance MVP). A Redis
// backend can replace it for multi-instance deployments without changing the
// handlers.

import type { ParsedFile } from '@medicore/contracts';

export interface IParsedFileCache {
  set(batchId: string, organizationId: string, file: ParsedFile): Promise<void>;
  get(batchId: string, organizationId: string): Promise<ParsedFile | null>;
  delete(batchId: string, organizationId: string): Promise<void>;
}

export const PARSED_FILE_CACHE = Symbol('PARSED_FILE_CACHE');
