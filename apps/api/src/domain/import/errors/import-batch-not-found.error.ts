// apps/api/src/domain/import/errors/import-batch-not-found.error.ts

export class ImportBatchNotFoundError extends Error {
  public readonly code = 'IMPORT_BATCH_NOT_FOUND';

  constructor(public readonly batchId: string) {
    super(`Import batch not found: ${batchId}`);
    this.name = 'ImportBatchNotFoundError';
  }
}