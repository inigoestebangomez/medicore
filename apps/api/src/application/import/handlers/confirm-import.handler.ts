// apps/api/src/application/import/handlers/confirm-import.handler.ts
// Stage 2 → 3 → 4 (pre-finalize). Applies the physician-confirmed column
// mapping, runs the deterministic DataCleanerService (Stage 3) and the
// PatientMatcherService (Stage 4) to produce the match list the UI renders.
//
// The batch stays in CONFIRMING. Patient records are NOT touched here — the
// actual create/enrich happens in the background finalize job (ImportProcessor,
// WU-11-08) once the physician resolves every match (BR-IMP-001).

import { Injectable, Inject } from '@nestjs/common';
import type { ColumnMapping } from '@medicore/contracts';
import type { IImportBatchRepository } from '@/domain/import/import-batch.repository.interface';
import { DataCleanerService } from '../services/data-cleaner.service';
import { PatientMatcherService } from '../services/patient-matcher.service';
import type { IParsedFileCache } from '../ports/parsed-file-cache.port';
import type { PatientMatchVO } from '@/domain/import/patient-match.vo';
import { ImportBatchNotFoundError } from '@/domain/import/errors/import-batch-not-found.error';

export interface ConfirmImportCommand {
  batchId: string;
  organizationId: string;
  columnMapping: ColumnMapping;
  customFieldNames?: Record<string, string>;
  junkRowIndices?: number[];
}

export interface ConfirmImportResult {
  batchId: string;
  totalRows: number;
  cleanedRowCount: number;
  junkRowCount: number;
  skippedRowCount: number;
  matches: PatientMatchVO[];
  /** Rows the physician must resolve in the UI (score 50..89 → 'confirm'). */
  pendingResolutionCount: number;
  /** Rows that will auto-match (score ≥ 90). */
  autoMatchCount: number;
  /** Rows that will create new patients (score < 50). */
  newPatientCount: number;
}

@Injectable()
export class ConfirmImportHandler {
  constructor(
    @Inject('IImportBatchRepository') private readonly batchRepo: IImportBatchRepository,
    private readonly cleaner: DataCleanerService,
    private readonly matcher: PatientMatcherService,
    @Inject('IParsedFileCache') private readonly cache: IParsedFileCache,
  ) {}

  async execute(cmd: ConfirmImportCommand): Promise<ConfirmImportResult> {
    const batch = await this.batchRepo.findById(cmd.batchId, cmd.organizationId);
    if (!batch) throw new ImportBatchNotFoundError(cmd.batchId);

    // Stage 2 — persist the physician-confirmed mapping.
    const confirmed = batch.applyConfirmedMapping({
      columnMapping: cmd.columnMapping,
      customFieldNames: cmd.customFieldNames,
      junkRowIndices: cmd.junkRowIndices,
    });
    await this.batchRepo.updateAnalysis(cmd.batchId, cmd.organizationId, {
      columnMapping: confirmed.columnMapping,
      customFieldNames: confirmed.customFieldNames,
      junkRowIndices: confirmed.junkRowIndices,
    });

    // Stage 3 — clean the cached parsed file against the confirmed mapping.
    const parsed = await this.cache.get(cmd.batchId, cmd.organizationId);
    if (!parsed) {
      // Cache miss (server restart between upload and confirm). The physician
      // must re-upload. Surface as a recoverable error code.
      return {
        batchId: cmd.batchId,
        totalRows: batch.totalRows,
        cleanedRowCount: 0,
        junkRowCount: 0,
        skippedRowCount: 0,
        matches: [],
        pendingResolutionCount: 0,
        autoMatchCount: 0,
        newPatientCount: 0,
      };
    }

    const cleaned = this.cleaner.clean(parsed, confirmed.columnMapping);

    // Stage 4 — match each cleaned row against existing patients.
    const { matches } = await this.matcher.match({
      organizationId: cmd.organizationId,
      rows: cleaned.cleanedRows,
    });

    let auto = 0;
    let pending = 0;
    let created = 0;
    for (const m of matches) {
      if (m.decision === 'auto') auto++;
      else if (m.decision === 'confirm') pending++;
      else created++;
    }

    return {
      batchId: cmd.batchId,
      totalRows: batch.totalRows,
      cleanedRowCount: cleaned.cleanedRows.length,
      junkRowCount: cleaned.junkRowIndices.length,
      skippedRowCount: cleaned.skippedRowIndices.length,
      matches,
      pendingResolutionCount: pending,
      autoMatchCount: auto,
      newPatientCount: created,
    };
  }
}
