// apps/api/src/application/import/handlers/confirm-import.handler.ts
// Stage 2 → 3 → 4 (pre-finalize). Applies the physician-confirmed column
// mapping, runs the deterministic DataCleanerService (Stage 3) and the
// PatientMatcherService (Stage 4) to produce the match list the UI renders.
//
// The batch stays in CONFIRMING. Patient records are NOT touched here — the
// actual create/enrich happens in the background finalize job (ImportProcessor,
// WU-11-08) once the physician resolves every match (BR-IMP-001).

import { Injectable, Inject } from '@nestjs/common';
import type {
  CellOverrides,
  ColumnMapping,
  IgnoredColumn,
  IgnoredRow,
  PreviewOverrides,
  RowClassification,
} from '@medicore/contracts';
import { validateColumnMapping } from '@medicore/contracts';
import type { IImportBatchRepository } from '@/domain/import/import-batch.repository.interface';
import { DataCleanerService } from '../services/data-cleaner.service';
import { PatientMatcherService } from '../services/patient-matcher.service';
import type { IParsedFileCache } from '../ports/parsed-file-cache.port';
import type { PatientMatchVO } from '@/domain/import/patient-match.vo';
import { ImportBatchNotFoundError } from '@/domain/import/errors/import-batch-not-found.error';
import { ImportPreviewUnavailableError } from '@/domain/import/errors/import-preview-unavailable.error';
import { ImportColumnMappingConflictError } from '@/domain/import/errors/import-column-mapping-conflict.error';

export interface ConfirmImportCommand {
  batchId: string;
  organizationId: string;
  columnMapping: ColumnMapping;
  customFieldNames?: Record<string, string>;
  junkRowIndices?: number[];
  previewOverrides?: PreviewOverrides;
  ignoredColumns?: IgnoredColumn[];
  ignoredRows?: IgnoredRow[];
  cellOverrides?: CellOverrides;
}

export interface ConfirmImportResult {
  batchId: string;
  totalRows: number;
  cleanedRowCount: number;
  junkRowCount: number;
  skippedRowCount: number;
  discardedRowCount: number;
  matches: PatientMatchVO[];
  /** Rows requiring physician action: match review plus unidentifiable rows. */
  pendingResolutionCount: number;
  /** Rows that will auto-match (score ≥ 90). */
  autoMatchCount: number;
  /** Rows that will create new patients (score < 50). */
  newPatientCount: number;
  fullIdentityRows: RowClassification[];
  identityLightRows: RowClassification[];
  unidentifiableRows: RowClassification[];
  fullIdentityCount: number;
  identityLightCount: number;
  unidentifiableCount: number;
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

    const mappingValidation = validateColumnMapping(cmd.columnMapping);
    if (!mappingValidation.valid) {
      throw new ImportColumnMappingConflictError(mappingValidation.conflicts);
    }

    // Stage 2 — persist the physician-confirmed mapping.
    const confirmed = batch.applyConfirmedMapping({
      columnMapping: cmd.columnMapping,
      customFieldNames: cmd.customFieldNames,
      junkRowIndices: cmd.junkRowIndices,
      previewOverrides: cmd.previewOverrides,
      ignoredColumns: cmd.ignoredColumns,
      ignoredRows: cmd.ignoredRows,
      cellOverrides: cmd.cellOverrides,
    });
    await this.batchRepo.updateAnalysis(cmd.batchId, cmd.organizationId, {
      columnMapping: confirmed.columnMapping,
      customFieldNames: confirmed.customFieldNames,
      junkRowIndices: confirmed.junkRowIndices,
      previewOverrides: confirmed.previewOverrides ?? undefined,
      ignoredColumns: confirmed.ignoredColumns,
      ignoredRows: confirmed.ignoredRows,
      cellOverrides: confirmed.cellOverrides ?? undefined,
    });

    // Stage 3 — clean the cached parsed file against the confirmed mapping.
    const parsed = (await this.cache.get(cmd.batchId, cmd.organizationId)) ?? batch.toParsedFile();
    if (!parsed) {
      throw new ImportPreviewUnavailableError();
    }

    const cleaned = this.cleaner.clean(parsed, confirmed.columnMapping, {
      previewOverrides: confirmed.previewOverrides ?? undefined,
      ignoredColumns: confirmed.ignoredColumns,
      ignoredRows: confirmed.ignoredRows,
      cellOverrides: confirmed.cellOverrides ?? undefined,
    });

    // Keep the pending count on the aggregate so finalize can reject the
    // batch before enqueueing work, while the response exposes row details.
    await this.batchRepo.updateAnalysis(cmd.batchId, cmd.organizationId, {
      columnMapping: confirmed.columnMapping,
      pendingRows: cleaned.unidentifiableRows.length,
    });

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
      discardedRowCount: cleaned.discardedRowIndices.length,
      matches,
      pendingResolutionCount: pending + cleaned.unidentifiableRows.length,
      autoMatchCount: auto,
      newPatientCount: created,
      fullIdentityRows: cleaned.fullIdentityRows,
      identityLightRows: cleaned.identityLightRows,
      unidentifiableRows: cleaned.unidentifiableRows,
      fullIdentityCount: cleaned.fullIdentityRows.length,
      identityLightCount: cleaned.identityLightRows.length,
      unidentifiableCount: cleaned.unidentifiableRows.length,
    };
  }
}
