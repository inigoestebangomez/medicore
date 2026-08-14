// apps/api/src/infrastructure/queues/import-processor.ts
// BullMQ worker for Stage 5 (finalize import). Reads the cached parsed file,
// applies the confirmed column mapping + the physician's match resolutions,
// creates new patients or enriches existing ones (BR-IMP-003 precedence:
// manual > imported), updates the batch counters, and completes the batch.
//
// This is the ONLY place Patient records are mutated by the import module
// (BR-IMP-001). On any unrecoverable error the batch is marked FAILED and the
// physician can retry finalize or revert.

import { Processor, Process } from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import type { Job } from 'bullmq';
import type { ColumnMapping, MatchDecision } from '@medicore/contracts';
import type { IImportBatchRepository } from '@/domain/import/import-batch.repository.interface';
import type { IPatientRepository, CreatePatientInput } from '@/domain/patient/patient.repository.interface';
import type { Patient } from '@/domain/patient/patient.entity';
import { DataCleanerService } from '@/application/import/services/data-cleaner.service';
import { buildPatientInputFromRow } from '@/application/import/services/patient-input-builder';
import type { IParsedFileCache } from '@/application/import/ports/parsed-file-cache.port';
import type { FieldCatalogCachePort } from '@/application/research/ports/field-catalog-cache.port';
import { ImportBatchNotFoundError } from '@/domain/import/errors/import-batch-not-found.error';
import { ImportBlockedByUnidentifiableError } from '@/domain/import/errors/import-blocked-by-unidentifiable.error';
import { ImportNhcConflictError } from '@/domain/import/errors/import-nhc-conflict.error';
import { ImportNoPatientsProcessedError } from '@/domain/import/errors/import-no-patients-processed.error';
import { FeatureFlagsService } from '@/infrastructure/config/feature-flags.service';

export const IMPORT_QUEUE_NAME = 'import';

export interface ImportFinalizeJobData {
  batchId: string;
  organizationId: string;
  userId: string;
  matchResolutions: Record<string, MatchDecision>;
}

export const IMPORT_QUEUE = IMPORT_QUEUE_NAME;

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

const TRANSIENT_PRISMA_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017']);

export function isTransientImportError(error: unknown): boolean {
  const values: unknown[] = [];
  const visit = (value: unknown, seen: Set<unknown>) => {
    if (!value || (typeof value !== 'object' && typeof value !== 'string') || seen.has(value)) return;
    seen.add(value);
    if (typeof value === 'string') {
      values.push(value);
      return;
    }
    const record = value as Record<string, unknown>;
    values.push(record.code, record.message);
    visit(record.cause, seen);
    visit(record.originalError, seen);
  };
  visit(error, new Set());

  return values.some((value) => {
    if (typeof value !== 'string') return false;
    const normalized = value.toUpperCase();
    return TRANSIENT_PRISMA_CODES.has(normalized)
      || /(?:^|[^A-Z0-9])E?57P01(?:$|[^A-Z0-9])/.test(normalized);
  });
}

function mergeBatchBlock(
  existing: unknown,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return incoming;

  const previous = existing as Record<string, unknown>;
  const previousRows = Array.isArray(previous._rowIndices)
    ? previous._rowIndices.filter((value): value is number => typeof value === 'number')
    : typeof previous._rowIndex === 'number'
      ? [previous._rowIndex]
      : [];
  const rowIndex = incoming._rowIndex;
  const rowIndices = typeof rowIndex === 'number' && !previousRows.includes(rowIndex)
    ? [...previousRows, rowIndex]
    : previousRows;
  const merged = { ...previous, ...incoming };

  if (rowIndices.length > 1) {
    merged._rowIndex = rowIndices[0];
    merged._rowIndices = rowIndices;
  }
  return merged;
}

function serializeBatchDate(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

@Processor(IMPORT_QUEUE_NAME)
export class ImportProcessor {
  private readonly logger = new Logger(ImportProcessor.name);

  constructor(
    @Inject('IImportBatchRepository') private readonly batchRepo: IImportBatchRepository,
    @Inject('IPatientRepository') private readonly patientRepo: IPatientRepository,
    private readonly cleaner: DataCleanerService,
    @Inject('IParsedFileCache') private readonly cache: IParsedFileCache,
    // Research Engine V2 — invalidate the field catalog cache on import
    // completion so newly imported fields appear in field-discovery autocomplete
    // (design AD-3). Optional: guarded so the import queue keeps working even
    // when the research module is not wired in this deployment.
    @Inject('FieldCatalogCachePort') private readonly fieldCache?: FieldCatalogCachePort,
    @Inject(FeatureFlagsService) private readonly featureFlags: FeatureFlagsService = new FeatureFlagsService(),
  ) {}

  @Process('finalize')
  async handleFinalize(job: Job<ImportFinalizeJobData>): Promise<{
    created: number;
    enriched: number;
    skipped: number;
    discardedRowCount: number;
  }> {
    const { batchId, organizationId, userId, matchResolutions } = job.data;
    this.logger.log(`Finalizing import batch ${batchId}`);

    let batch: Awaited<ReturnType<IImportBatchRepository['findById']>> = null;
    let completed = false;
    try {
      // Keep every finalize stage inside this boundary. A connection failure in
      // lookup, cache access, or cleaning must reach Bull's retry policy too.
      batch = await this.batchRepo.findById(batchId, organizationId);
      if (!batch) throw new ImportBatchNotFoundError(batchId);
      if (batch.status === 'COMPLETED') {
        return {
          created: batch.createdRows,
          enriched: batch.enrichedRows,
          skipped: batch.skippedRows,
          discardedRowCount: new Set(batch.ignoredRows.map(({ rowIndex }) => rowIndex)).size,
        };
      }

      const parsed = (await this.cache.get(batchId, organizationId)) ?? batch.toParsedFile();
      if (!parsed) {
        throw new Error(`Parsed file cache miss and persisted rows unavailable for batch ${batchId} — re-upload required`);
      }

      const cleaned = this.cleaner.clean(parsed, batch.columnMapping as ColumnMapping, {
        previewOverrides: batch.previewOverrides ?? undefined,
        ignoredColumns: batch.ignoredColumns,
        ignoredRows: batch.ignoredRows,
        cellOverrides: batch.cellOverrides ?? undefined,
      });
      if (cleaned.unidentifiableRows.length > 0) {
        throw new ImportBlockedByUnidentifiableError(cleaned.unidentifiableRows.length);
      }

      // Snapshot pre-import state for revert (BR-IMP-005). We store the set of
      // affected patient ids + their pre-import importedData so revert can
      // restore precisely. New patients aren't snapshotted (revert strips their
      // importedData block and clears importBatchId, but does not delete them —
      // a created patient's manual fields, if any, are preserved).
      const snapshot: Record<string, unknown> = { affectedPatientIds: [], ts: new Date().toISOString() };
      await this.batchRepo.updateStatus(batchId, organizationId, 'PROCESSING');

      let created = 0;
      let enriched = 0;
      let skipped = 0;
      let alreadyProcessed = 0;
      const affectedIds: string[] = [];
      // SDD import-data-quality: false-record rows flagged by the cleaner are
      // skipped entirely (never create/enrich a patient for an equipment name
      // or admin note that slipped past junk detection).
      const falseRecordRows = new Set<number>(cleaned.falseRecordRowIndices);

      for (const row of cleaned.cleanedRows) {
        const alreadyWritten = this.patientRepo.findByImportBatchRow
          ? await this.patientRepo.findByImportBatchRow(batchId, organizationId, row.rowIndex)
          : null;
        if (alreadyWritten) {
          alreadyProcessed++;
          continue;
        }

        if (falseRecordRows.has(row.rowIndex)) {
          this.logger.warn(`Skipping false-record row ${row.rowIndex}`);
          skipped++;
          continue;
        }

        // Resolve the physician decision for this row index.
        const decision: MatchDecision = matchResolutions[String(row.rowIndex)] ?? 'new';

        // SDD import-data-quality: name normalization + null birthDate + phone
        // come from the shared, pure row → patient-parts builder.
        const parts = buildPatientInputFromRow(
          row,
          this.featureFlags.isEnabled('IMPORT_IDENTITY_LIGHT'),
        );

        // Build the importedData block for this batch (BR-IMP-002: original
        // Excel values preserved, phone columns already stripped by the cleaner).
        const batchBlock = {
          _batchName: batch.fileName,
          _importedAt: new Date().toISOString(),
          _rowIndex: row.rowIndex,
          ...(row.ageAtImport !== null && row.ageAtImport !== undefined ? { ageAtImport: row.ageAtImport } : {}),
          ...row.customFields,
          ...(row.diagnosis ? { diagnosis: row.diagnosis } : {}),
          ...(row.procedure ? { procedure: row.procedure } : {}),
          ...(row.admissionDate ? { admissionDate: serializeBatchDate(row.admissionDate) } : {}),
          ...(row.testType ? { testType: row.testType } : {}),
          ...(row.requestDate ? { requestDate: serializeBatchDate(row.requestDate) } : {}),
          ...(row.completionDate ? { completionDate: serializeBatchDate(row.completionDate) } : {}),
        };

        // The match decision is a UI snapshot. Revalidate the strongest
        // identity signal immediately before any create, including decision=new.
        const existing = row.nhc
          ? await this.findImportPatientByNhc(row.nhc, organizationId)
          : null;
        if (existing) {
          await this.enrichExistingPatient(existing, organizationId, batchId, batchBlock, batch.originalFormat, row.birthDate, row.sex, userId);
          affectedIds.push(existing.id);
          enriched++;
          continue;
        }

        // 'auto'/'confirm' without an NHC cannot be safely resolved by the
        // processor; preserve the existing behavior and leave it skipped.
        if (decision !== 'new' && !row.nhc) {
          skipped++;
          continue;
        }

        // Create a new patient. Standard fields come from the row; the NHC is
        // imported when present, otherwise a generated MediCore NHC is used.
        const nhc = row.nhc ?? await this.patientRepo.getNextNhcSequence(organizationId);
        const input: CreatePatientInput = {
          nhc,
          firstName: parts.firstName,
          lastName: parts.lastName,
          birthDate: parts.birthDate,
          phone: parts.phone,
          sex: (row.sex ?? 'UNKNOWN') as any,
          organizationId,
          createdBy: userId,
        };
        const write = await this.createPatientWithRaceRecovery(input, row.nhc, organizationId);
        const createdPatient = write.patient;
        await this.enrichExistingPatient(createdPatient, organizationId, batchId, batchBlock, batch.originalFormat, row.birthDate, row.sex, userId);
        affectedIds.push(createdPatient.id);
        if (write.created) created++;
        else enriched++;
      }

      const discardedRowCount = cleaned.discardedRowIndices.length;
      skipped += cleaned.skippedRowIndices.length
        + cleaned.junkRowIndices.length
        + cleaned.falseRecordRowIndices.length;

      if (cleaned.cleanedRows.length > 0 && created + enriched + alreadyProcessed === 0) {
        throw new ImportNoPatientsProcessedError(cleaned.cleanedRows.length);
      }

      snapshot.affectedPatientIds = affectedIds;
      const processing = await this.batchRepo.findById(batchId, organizationId);
      if (processing) {
        await this.batchRepo.updateCounters(batchId, organizationId, {
          importedRows: created + enriched + alreadyProcessed,
          enrichedRows: enriched + alreadyProcessed,
          createdRows: created,
          skippedRows: skipped,
          pendingRows: 0,
        });
      }
      await this.batchRepo.updateStatus(batchId, organizationId, 'COMPLETED');
      completed = true;
      await this.cache.delete(batchId, organizationId);

      // Research V2 (AD-3): invalidate the field catalog cache so the next
      // field-discovery request regenerates it with the new imported fields.
      try {
        if (this.fieldCache) await this.fieldCache.invalidate(organizationId);
      } catch (err) {
        this.logger.warn(`Field catalog invalidation failed for org ${organizationId}: ${(err as Error).message}`);
      }

      this.logger.log(`Import batch ${batchId} complete: ${created} new, ${enriched} enriched, ${skipped} skipped, ${discardedRowCount} discarded`);
      return { created, enriched, skipped, discardedRowCount };
    } catch (err) {
      return await this.handleFinalizeError(batchId, organizationId, batch, completed, err);
    }
  }

  private async handleFinalizeError(
    batchId: string,
    organizationId: string,
    batch: Awaited<ReturnType<IImportBatchRepository['findById']>>,
    completed: boolean,
    error: unknown,
  ): Promise<never> {
    const message = error instanceof Error ? error.message : 'Import finalization failed';

    if (isTransientImportError(error)) {
      this.logger.warn(`Transient import error for batch ${batchId}; Bull will retry: ${message}`);
      throw error;
    }

    try {
      if (batch && batch.status !== 'COMPLETED' && !completed) {
        await this.batchRepo.updateStatus(batchId, organizationId, 'FAILED', message);
      }
    } catch (statusError) {
      this.logger.error(
        `Could not persist FAILED status for import batch ${batchId}: ${statusError instanceof Error ? statusError.message : String(statusError)}`,
      );
      // Do not hide the original failure. Throwing a normal error lets Bull's
      // bounded retry repair a transient failure in status persistence.
      throw error;
    }

    this.logger.error(`Import batch ${batchId} failed: ${message}`);
    const nonRetryable = new UnrecoverableError(message);
    (nonRetryable as Error & { cause?: unknown }).cause = error;
    throw nonRetryable;
  }

  private async findImportPatientByNhc(nhc: string, organizationId: string): Promise<Patient | null> {
    const active = await this.patientRepo.findByNhc(nhc, organizationId);
    if (active) return active;

    const occupying = this.patientRepo.findByNhcIncludingDeleted
      ? await this.patientRepo.findByNhcIncludingDeleted(nhc, organizationId)
      : null;
    if (occupying?.deletedAt) {
      throw new ImportNhcConflictError(nhc, 'soft-deleted');
    }
    return null;
  }

  private async createPatientWithRaceRecovery(
    input: CreatePatientInput,
    importedNhc: string | null,
    organizationId: string,
  ): Promise<{ patient: Patient; created: boolean }> {
    try {
      return { patient: await this.patientRepo.create(input), created: true };
    } catch (error) {
      if (!isPrismaUniqueConstraintError(error) || !importedNhc) throw error;

      const active = await this.patientRepo.findByNhc(importedNhc, organizationId);
      if (active) return { patient: active, created: false };

      const occupying = this.patientRepo.findByNhcIncludingDeleted
        ? await this.patientRepo.findByNhcIncludingDeleted(importedNhc, organizationId)
        : null;
      if (occupying?.deletedAt) {
        throw new ImportNhcConflictError(importedNhc, 'soft-deleted');
      }
      throw new ImportNhcConflictError(importedNhc, 'unresolved');
    }
  }

  private async enrichExistingPatient(
    patient: Patient,
    organizationId: string,
    batchId: string,
    batchBlock: Record<string, unknown>,
    importSource: string,
    birthDate: Date | null,
    sex: string | null,
    updatedBy: string,
  ): Promise<void> {
    const existingImported = patient.importedData ?? {};
    await this.patientRepo.enrich(
      patient.id,
      organizationId,
      {
        importedData: {
          ...existingImported,
          [batchId]: mergeBatchBlock(existingImported[batchId], batchBlock),
        },
        importBatchId: batchId,
        importSource,
        ...(birthDate ? { birthDate } : {}),
        ...(sex ? { sex } : {}),
      },
      updatedBy,
    );
  }
}
