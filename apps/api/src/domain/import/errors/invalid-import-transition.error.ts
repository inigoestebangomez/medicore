// apps/api/src/domain/import/errors/invalid-import-transition.error.ts
import type { ImportStatus } from '@medicore/contracts';

export class InvalidImportTransitionError extends Error {
  public readonly code = 'INVALID_IMPORT_TRANSITION';

  constructor(public readonly fromStatus: ImportStatus, public readonly toStatus: ImportStatus) {
    super(`Invalid import transition: ${fromStatus} → ${toStatus}`);
    this.name = 'InvalidImportTransitionError';
  }
}