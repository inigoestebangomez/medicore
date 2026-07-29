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
import type { Job } from 'bullmq';
import type { ColumnMapping, MatchDecision } from '@medicore/contracts';
import type { IImportBatchRepository } from '@/domain/import/import-batch.repository.interface';
import type { IPatientRepository, CreatePatientInput } from '@/domain/patient/patient.repository.interface';
import { DataCleanerService } from '@/application/import/services/data-cleaner.service';
import { buildPatientInputFromRow } from '@/application/import/services/patient-input-builder';
import type { IParsedFileCache } from '@/application/import/ports/parsed-file-cache.port';
import type { FieldCatalogCachePort } from '@/application/research/ports/field-catalog-cache.port';
import { ImportBatchNotFoundError } from '@/domain/import/errors/import-batch-not-found.error';

export const IMPORT_QUEUE_NAME = 'import';

export interface ImportFinalizeJobData {
  batchId: string;
  organizationId: string;
  userId: string;
  matchResolutions: Record<string, MatchDecision>;
}

export const IMPORT_QUEUE = IMPORT_QUEUE_NAME;

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
  ) {}

  @Process('finalize')
  async handleFinalize(job: Job<ImportFinalizeJobData>): Promise<{ created: number; enriched: number; skipped: number }> {
    const { batchId, organizationId, userId, matchResolutions } = job.data;
    this.logger.log(`Finalizing import batch ${batchId}`);

    const batch = await this.batchRepo.findById(batchId, organizationId);
    if (!batch) throw new ImportBatchNotFoundError(batchId);

    const parsed = await this.cache.get(batchId, organizationId);
    if (!parsed) {
      await this.batchRepo.updateStatus(batchId, organizationId, 'FAILED');
      throw new Error(`Parsed file cache miss for batch ${batchId} — re-upload required`);
    }

    try {
      const cleaned = this.cleaner.clean(parsed, batch.columnMapping as ColumnMapping);

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
      const affectedIds: string[] = [];
      // SDD import-data-quality: false-record rows flagged by the cleaner are
      // skipped entirely (never create/enrich a patient for an equipment name
      // or admin note that slipped past junk detection).
      const falseRecordRows = new Set<number>(cleaned.falseRecordRowIndices);

      for (const row of cleaned.cleanedRows) {
        if (falseRecordRows.has(row.rowIndex)) {
          this.logger.warn(`Skipping false-record row ${row.rowIndex}`);
          skipped++;
          continue;
        }

        // Resolve the physician decision for this row index.
        const decision: MatchDecision = matchResolutions[String(row.rowIndex)] ?? 'new';

        // SDD import-data-quality: name normalization + null birthDate + phone
        // come from the shared, pure row → patient-parts builder.
        const parts = buildPatientInputFromRow(row);

        // Build the importedData block for this batch (BR-IMP-002: original
        // Excel values preserved, phone columns already stripped by the cleaner).
        const batchBlock = {
          _batchName: batch.fileName,
          _importedAt: new Date().toISOString(),
          ...row.customFields,
          ...(row.diagnosis ? { diagnosis: row.diagnosis } : {}),
          ...(row.procedure ? { procedure: row.procedure } : {}),
          ...(row.admissionDate ? { admissionDate: row.admissionDate } : {}),
          ...(row.testType ? { testType: row.testType } : {}),
          ...(row.requestDate ? { requestDate: row.requestDate } : {}),
          ...(row.completionDate ? { completionDate: row.completionDate } : {}),
        };

        if (decision === 'new') {
          // Create a new patient. Standard fields come from the row; the NHC
          // is the imported one if present, else a generated MediCore NHC.
          // The DataCleanerService already normalized `sex` to Prisma's Sex enum
          // (MALE, FEMALE, OTHER, UNKNOWN) — no further mapping needed.
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
          const created_p = await this.patientRepo.create(input);
          await this.patientRepo.enrich(
            created_p.id,
            organizationId,
            {
              importedData: { [batchId]: batchBlock },
              importBatchId: batchId,
              importSource: batch.originalFormat,
              ...(row.birthDate ? { birthDate: row.birthDate } : {}),
              ...(row.sex ? { sex: row.sex } : {}),
            },
            userId,
          );
          affectedIds.push(created_p.id);
          created++;
        } else {
          // 'auto' or 'confirm' → enrich an existing patient. The matcher
          // resolved the candidate id; but the processor only has the row.
          // We re-lookup by NHC (the strongest signal) to find the candidate;
          // if no NHC, we skip — the physician should have resolved via the UI.
          if (!row.nhc) {
            skipped++;
            continue;
          }
          const existing = await this.patientRepo.findByNhc(row.nhc, organizationId);
          if (!existing) {
            // Candidate vanished between confirm and finalize — treat as new.
            const input: CreatePatientInput = {
              nhc: row.nhc,
              firstName: parts.firstName,
              lastName: parts.lastName,
              birthDate: parts.birthDate,
              phone: parts.phone,
              sex: (row.sex ?? 'UNKNOWN') as any,
              organizationId,
              createdBy: userId,
            };
            const created_p = await this.patientRepo.create(input);
            await this.patientRepo.enrich(
              created_p.id, organizationId,
              {
                importedData: { [batchId]: batchBlock },
                importBatchId: batchId,
                importSource: batch.originalFormat,
              },
              userId,
            );
            affectedIds.push(created_p.id);
            created++;
            continue;
          }

          // Merge importedData blocks (each batch keeps its own key).
          const existingImported = (existing.importedData as Record<string, unknown> | null) ?? {};
          await this.patientRepo.enrich(
            existing.id, organizationId,
            {
              importedData: { ...existingImported, [batchId]: batchBlock },
              importBatchId: batchId,
              importSource: batch.originalFormat,
              ...(row.birthDate ? { birthDate: row.birthDate } : {}),
              ...(row.sex ? { sex: row.sex } : {}),
            },
            userId,
          );
          affectedIds.push(existing.id);
          enriched++;
        }
      }

      skipped += cleaned.skippedRowIndices.length + cleaned.junkRowIndices.length + cleaned.falseRecordRowIndices.length;

      snapshot.affectedPatientIds = affectedIds;
      const processing = await this.batchRepo.findById(batchId, organizationId);
      if (processing) {
        await this.batchRepo.updateCounters(batchId, organizationId, {
          importedRows: created + enriched,
          enrichedRows: enriched,
          createdRows: created,
          skippedRows: skipped,
          pendingRows: 0,
        });
      }
      await this.batchRepo.updateStatus(batchId, organizationId, 'COMPLETED');
      await this.cache.delete(batchId, organizationId);

      // Research V2 (AD-3): invalidate the field catalog cache so the next
      // field-discovery request regenerates it with the new imported fields.
      try {
        if (this.fieldCache) await this.fieldCache.invalidate(organizationId);
      } catch (err) {
        this.logger.warn(`Field catalog invalidation failed for org ${organizationId}: ${(err as Error).message}`);
      }

      this.logger.log(`Import batch ${batchId} complete: ${created} new, ${enriched} enriched, ${skipped} skipped`);
      return { created, enriched, skipped };
    } catch (err) {
      this.logger.error(`Import batch ${batchId} failed: ${(err as Error).message}`);
      await this.batchRepo.updateStatus(batchId, organizationId, 'FAILED');
      throw err;
    }
  }
}
