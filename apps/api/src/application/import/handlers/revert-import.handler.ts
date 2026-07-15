// apps/api/src/application/import/handlers/revert-import.handler.ts
// BR-IMP-005. Reverts a finalized import: soft-deletes the ImportBatch and
// strips its importedData block from every patient that batch created or
// enriched. Manual standard fields are never touched (precedence: manual >
// imported, BR-IMP-003). Also purges the parsed-file cache.

import { Injectable, Inject } from '@nestjs/common';
import type { IImportBatchRepository } from '@/domain/import/import-batch.repository.interface';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import type { IParsedFileCache } from '../ports/parsed-file-cache.port';
import { ImportBatchNotFoundError } from '@/domain/import/errors/import-batch-not-found.error';
import { ImportAlreadyFinalizedError } from '@/domain/import/errors/import-already-finalized.error';

export interface RevertImportCommand {
  batchId: string;
  organizationId: string;
  revertedBy: string;
}

export interface RevertImportResult {
  batchId: string;
  reverted: boolean;
  affectedPatients: number;
}

@Injectable()
export class RevertImportHandler {
  constructor(
    @Inject('IImportBatchRepository') private readonly batchRepo: IImportBatchRepository,
    @Inject('IPatientRepository') private readonly patientRepo: IPatientRepository,
    @Inject('IParsedFileCache') private readonly cache: IParsedFileCache,
  ) {}

  async execute(cmd: RevertImportCommand): Promise<RevertImportResult> {
    const batch = await this.batchRepo.findById(cmd.batchId, cmd.organizationId);
    if (!batch) throw new ImportBatchNotFoundError(cmd.batchId);
    if (batch.isReverted) {
      // Idempotent revert: already done. Report zero new affected patients.
      return { batchId: cmd.batchId, reverted: true, affectedPatients: 0 };
    }

    // Only terminal batches can be reverted. Attempting on a non-terminal
    // batch throws InvalidImportTransitionError via batch.revert(); the API
    // layer maps that to a 409. Catching ImportAlreadyFinalizedError here
    // would be wrong — revert requires a terminal state, not forbids one.
    const revertedBatch = batch.revert();
    await this.batchRepo.softDelete(cmd.batchId, cmd.organizationId);

    // Strip importedData[batchId] and clear importBatchId for affected patients.
    const affected = await this.patientRepo.removeImportedBatch(
      cmd.batchId,
      cmd.organizationId,
    );

    await this.cache.delete(cmd.batchId, cmd.organizationId);
    void revertedBatch;
    void cmd.revertedBy;

    return {
      batchId: cmd.batchId,
      reverted: true,
      affectedPatients: affected,
    };
  }
}

// Re-export so the API layer can map the domain error without a second import.
export { ImportAlreadyFinalizedError };
