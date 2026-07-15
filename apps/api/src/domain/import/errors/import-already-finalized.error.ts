// apps/api/src/domain/import/errors/import-already-finalized.error.ts
import type { ImportStatus } from '@medicore/contracts';

export class ImportAlreadyFinalizedError extends Error {
  public readonly code = 'IMPORT_ALREADY_FINALIZED';

  constructor(public readonly status: ImportStatus, public readonly attemptedAction: string) {
    super(`Cannot ${attemptedAction}: import batch is already in terminal state ${status}`);
    this.name = 'ImportAlreadyFinalizedError';
  }
}