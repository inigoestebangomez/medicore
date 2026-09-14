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
import { Inject, Logger, Optional } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import type { Job } from 'bullmq';
import type { ColumnMapping, MatchDecision, MatchResolution } from '@medicore/contracts';
import type { IImportBatchRepository } from '@/domain/import/import-batch.repository.interface';
import type { IPatientRepository, CreatePatientInput } from '@/domain/patient/patient.repository.interface';
import type { Patient } from '@/domain/patient/patient.entity';
import type { IConsultationRepository, CreateConsultationInput } from '@/domain/consultation/consultation.repository.interface';
import type { ISurgeryRepository, CreateSurgeryInput } from '@/domain/surgery/surgery.repository.interface';
import { importMaterializedAuditLog } from '@/domain/import/import-provenance';
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
  matchResolutions: Record<string, MatchResolution>;
}

interface ImportMaterializationCounts {
  consultationsCreated: number;
  surgeriesCreated: number;
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
    @Inject('IConsultationRepository') @Optional() private readonly consultationRepo?: IConsultationRepository,
    @Inject('ISurgeryRepository') @Optional() private readonly surgeryRepo?: ISurgeryRepository,
  ) {}

  @Process('finalize')
  async handleFinalize(job: Job<ImportFinalizeJobData>): Promise<{
    created: number;
    enriched: number;
    skipped: number;
    discardedRowCount: number;
    consultationsCreated?: number;
    surgeriesCreated?: number;
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
          ...(this.materializationConfigured() ? { consultationsCreated: 0, surgeriesCreated: 0 } : {}),
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
        referenceDate: batch.createdAt,
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
      const materializedCounts: ImportMaterializationCounts = { consultationsCreated: 0, surgeriesCreated: 0 };
      // SDD import-data-quality: false-record rows flagged by the cleaner are
      // skipped entirely (never create/enrich a patient for an equipment name
      // or admin note that slipped past junk detection).
      const falseRecordRows = new Set<number>(cleaned.falseRecordRowIndices);

      for (const row of cleaned.cleanedRows) {
        const alreadyWritten = this.patientRepo.findByImportBatchRow
          ? await this.patientRepo.findByImportBatchRow(batchId, organizationId, row.rowIndex)
          : null;
        if (alreadyWritten) {
          const materialized = await this.materializeClinicalRecords(alreadyWritten.id, row, batch, userId);
          materializedCounts.consultationsCreated += materialized.consultationsCreated;
          materializedCounts.surgeriesCreated += materialized.surgeriesCreated;
          alreadyProcessed++;
          continue;
        }

        if (falseRecordRows.has(row.rowIndex)) {
          this.logger.warn(`Skipping false-record row ${row.rowIndex}`);
          skipped++;
          continue;
        }

        // Resolve the physician decision for this row index.
        const resolution = matchResolutions[String(row.rowIndex)] ?? 'new';
        const decision: MatchDecision = typeof resolution === 'string' ? resolution : resolution.decision;
        const explicitCandidateId = typeof resolution === 'string' ? undefined : resolution.candidateId;

        // A candidate-aware confirmation is a physician choice, not another
        // fuzzy-search request. Revalidate it in this tenant immediately
        // before any write; never fall back to another patient or create one
        // when the selected candidate has disappeared.
        let explicitCandidate: Patient | null = null;
        if (decision !== 'new' && typeof resolution !== 'string') {
          if (!explicitCandidateId) {
            this.logger.warn(`Skipping row ${row.rowIndex}: confirmed patient candidate is missing`);
            skipped++;
            continue;
          }
          explicitCandidate = await this.patientRepo.findById(explicitCandidateId, organizationId);
          if (!explicitCandidate) {
            this.logger.warn(
              `Skipping row ${row.rowIndex}: confirmed patient candidate ${explicitCandidateId} is stale or unavailable for organization ${organizationId}`,
            );
            skipped++;
            continue;
          }
        }

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
          ...row.importedFields,
          ...(row.ageAtImport !== null && row.ageAtImport !== undefined ? { ageAtImport: row.ageAtImport } : {}),
          ...(row.birthDateEstimated ? {
            birthDateEstimated: true,
            birthDateReferenceYear: row.birthDateReferenceYear,
          } : {}),
          ...row.customFields,
          ...(row.birthDate ? { birthDate: serializeBatchDate(row.birthDate) } : {}),
          ...(row.sex ? { sex: row.sex } : {}),
          ...(parts.phone ? { phone: parts.phone } : {}),
          ...(parts.email ? { email: parts.email } : {}),
          ...(parts.idDocument ? { idDocument: parts.idDocument } : {}),
          ...(parts.idDocType ? { idDocType: parts.idDocType } : {}),
          ...(parts.bloodType ? { bloodType: parts.bloodType } : {}),
          ...(parts.notes ? { notes: parts.notes } : {}),
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
          await this.enrichExistingPatient(existing, organizationId, batchId, batchBlock, batch.originalFormat, row, parts, userId);
          affectedIds.push(existing.id);
          enriched++;
          const materialized = await this.materializeClinicalRecords(existing.id, row, batch, userId);
          materializedCounts.consultationsCreated += materialized.consultationsCreated;
          materializedCounts.surgeriesCreated += materialized.surgeriesCreated;
          continue;
        }

        if (explicitCandidate) {
          await this.enrichExistingPatient(explicitCandidate, organizationId, batchId, batchBlock, batch.originalFormat, row, parts, userId);
          affectedIds.push(explicitCandidate.id);
          enriched++;
          const materialized = await this.materializeClinicalRecords(explicitCandidate.id, row, batch, userId);
          materializedCounts.consultationsCreated += materialized.consultationsCreated;
          materializedCounts.surgeriesCreated += materialized.surgeriesCreated;
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
          email: parts.email,
          address: parts.address,
          emergencyContact: parts.emergencyContact,
          idDocument: parts.idDocument,
          idDocType: parts.idDocType ?? undefined,
          bloodType: parts.bloodType ?? undefined,
          notes: parts.notes,
          sex: (row.sex ?? 'UNKNOWN') as any,
          organizationId,
          createdBy: userId,
        };
        const write = await this.createPatientWithRaceRecovery(input, row.nhc, organizationId);
        const createdPatient = write.patient;
        await this.enrichExistingPatient(createdPatient, organizationId, batchId, batchBlock, batch.originalFormat, row, parts, userId);
        affectedIds.push(createdPatient.id);
        if (write.created) created++;
        else enriched++;
        const materialized = await this.materializeClinicalRecords(createdPatient.id, row, batch, userId);
        materializedCounts.consultationsCreated += materialized.consultationsCreated;
        materializedCounts.surgeriesCreated += materialized.surgeriesCreated;
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
      return {
        created,
        enriched,
        skipped,
        discardedRowCount,
        ...(this.materializationConfigured() ? materializedCounts : {}),
      };
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
    row: Parameters<typeof buildPatientInputFromRow>[0],
    parts: ReturnType<typeof buildPatientInputFromRow>,
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
        ...(row.patientName ? { firstName: parts.firstName, lastName: parts.lastName } : {}),
        ...(parts.phone ? { phone: parts.phone } : {}),
        ...(parts.email ? { email: parts.email } : {}),
        ...(parts.idDocument ? { idDocument: parts.idDocument } : {}),
        ...(parts.idDocType ? { idDocType: parts.idDocType } : {}),
        ...(parts.address ? { address: parts.address } : {}),
        ...(parts.bloodType ? { bloodType: parts.bloodType } : {}),
        ...(parts.emergencyContact ? { emergencyContact: parts.emergencyContact } : {}),
        ...(parts.notes ? { notes: parts.notes } : {}),
        ...(row.birthDate ? { birthDate: row.birthDate } : {}),
        ...(row.sex ? { sex: row.sex } : {}),
      },
      updatedBy,
    );
  }

  private materializationConfigured(): boolean {
    return Boolean(
      this.consultationRepo?.create && this.consultationRepo.findByImportBatchRow
        || this.surgeryRepo?.create && this.surgeryRepo.findByImportBatchRow,
    );
  }

  private async materializeClinicalRecords(
    patientId: string,
    row: Parameters<typeof buildPatientInputFromRow>[0],
    batch: NonNullable<Awaited<ReturnType<IImportBatchRepository['findById']>>>,
    userId: string,
  ): Promise<ImportMaterializationCounts> {
    const counts: ImportMaterializationCounts = { consultationsCreated: 0, surgeriesCreated: 0 };
    const marker = {
      importBatchId: batch.id,
      importRowIndex: row.rowIndex,
      performedBy: userId,
      performedAt: new Date().toISOString(),
    };
    const consultationDate = this.nativeClinicalDate(row, batch.createdAt, row.consultationDate);
    const surgeryDate = this.nativeClinicalDate(row, batch.createdAt, row.surgeryDate);

    const hasConsultationContent = Boolean(
      row.consultationDate || row.consultationType || row.chiefComplaint || row.currentIllness
      || row.physicalExam || row.assessment || row.diagnosisCodes || row.diagnosis || row.plan
      || row.followUpDate || row.followUpNotes || row.notes || row.testType,
    );
    if (hasConsultationContent && (!this.consultationRepo?.create || !this.consultationRepo.findByImportBatchRow)) {
      this.logger.warn(
        `Import batch ${batch.id} row ${row.rowIndex}: consultation materialization unavailable; imported history was preserved`,
      );
    }
    const hasSurgeryContent = Boolean(
      row.surgeryDate || row.procedure || row.surgeryStatus || row.asa || row.anesthesiaType
      || row.surgeryDurationMinutes !== null || row.technique || row.findings || row.complications
      || row.postOpNotes || row.outcome || row.hospitalStayDays !== null,
    );
    if (hasSurgeryContent && (!this.surgeryRepo?.create || !this.surgeryRepo.findByImportBatchRow)) {
      this.logger.warn(
        `Import batch ${batch.id} row ${row.rowIndex}: surgery materialization unavailable; imported history was preserved`,
      );
    }
    if (hasConsultationContent && this.consultationRepo?.create && this.consultationRepo.findByImportBatchRow) {
      const existing = await this.consultationRepo.findByImportBatchRow(batch.id, batch.organizationId, row.rowIndex);
      if (!existing) {
          const details = this.clinicalDetails(row);
          const consultation: CreateConsultationInput = {
            organizationId: batch.organizationId,
            patientId,
            date: consultationDate,
            type: (row.consultationType ?? 'FIRST_VISIT') as CreateConsultationInput['type'],
            physicianId: userId,
            chiefComplaint: row.chiefComplaint ?? row.diagnosis ?? row.testType ?? row.notes ?? 'Datos clínicos importados',
            currentIllness: row.currentIllness ?? (details || null),
            assessment: row.assessment ?? row.diagnosis,
            plan: row.plan ?? row.procedure,
            followUpDate: row.followUpDate,
            followUpNotes: row.followUpNotes,
            createdBy: userId,
          };
          // The native consultation has no free-form diagnosis-code import path.
          // Keep unvalidated text in the audit marker instead of inventing codes.
          await this.consultationRepo.create({
            ...consultation,
            physicalExam: {
              ...(row.physicalExam ? { importedText: row.physicalExam } : {}),
              importAuditLog: importMaterializedAuditLog({
                ...marker,
                importedFields: this.importedClinicalFields(row),
              }),
            },
          });
        counts.consultationsCreated++;
      }
    }

    if (hasSurgeryContent && this.surgeryRepo?.create && this.surgeryRepo.findByImportBatchRow) {
      const existing = await this.surgeryRepo.findByImportBatchRow(batch.id, batch.organizationId, row.rowIndex);
      if (!existing) {
        const asa = row.asa ?? null;
        const status = row.surgeryStatus === 'COMPLETED' && !asa
          ? 'SCHEDULED'
          : (row.surgeryStatus ?? 'SCHEDULED');
        const surgery: CreateSurgeryInput = {
          organizationId: batch.organizationId,
          patientId,
          date: surgeryDate,
          status: status as CreateSurgeryInput['status'],
          physicianId: userId,
          procedureType: row.procedure ?? 'Cirugía importada',
          asa,
          anesthesiaType: row.anesthesiaType,
          preOpNotes: this.clinicalDetails(row) || null,
          technique: row.technique ? { importedText: row.technique } : null,
          findings: row.findings ?? null,
          complications: row.complications ?? null,
          postOpNotes: row.postOpNotes ?? null,
          outcome: row.outcome ?? null,
          duration: row.surgeryDurationMinutes,
          createdBy: userId,
          auditLog: importMaterializedAuditLog({
            ...marker,
            importedFields: this.importedClinicalFields(row),
          }),
        };
        await this.surgeryRepo.create(surgery);
        counts.surgeriesCreated++;
      }
    }

    return counts;
  }

  private nativeClinicalDate(
    row: Parameters<typeof buildPatientInputFromRow>[0],
    fallback: Date,
    preferred?: Date | null,
  ): Date {
    const now = Date.now();
    for (const candidate of [preferred, row.admissionDate, row.requestDate, row.completionDate]) {
      if (candidate instanceof Date && !Number.isNaN(candidate.getTime()) && candidate.getTime() <= now) {
        return candidate;
      }
    }
    return fallback.getTime() <= now ? fallback : new Date(now);
  }

  private clinicalDetails(row: Parameters<typeof buildPatientInputFromRow>[0]): string {
    return [
      row.currentIllness ? `Enfermedad actual: ${row.currentIllness}` : null,
      row.physicalExam ? `Exploración física: ${row.physicalExam}` : null,
      row.assessment ? `Valoración: ${row.assessment}` : null,
      row.diagnosisCodes ? `Códigos diagnósticos importados: ${row.diagnosisCodes}` : null,
      row.plan ? `Plan: ${row.plan}` : null,
      row.followUpDate ? `Fecha de seguimiento: ${row.followUpDate.toISOString()}` : null,
      row.followUpNotes ? `Notas de seguimiento: ${row.followUpNotes}` : null,
      row.notes ? `Notas: ${row.notes}` : null,
      row.testType ? `Prueba: ${row.testType}` : null,
      row.diagnosis ? `Diagnóstico: ${row.diagnosis}` : null,
      row.procedure ? `Procedimiento: ${row.procedure}` : null,
      row.admissionDate ? `Fecha de ingreso: ${row.admissionDate.toISOString()}` : null,
      row.requestDate ? `Fecha de solicitud: ${row.requestDate.toISOString()}` : null,
      row.completionDate ? `Fecha de realización: ${row.completionDate.toISOString()}` : null,
      row.anesthesiaType ? `Tipo de anestesia: ${row.anesthesiaType}` : null,
      row.technique ? `Técnica quirúrgica: ${row.technique}` : null,
      row.findings ? `Hallazgos: ${row.findings}` : null,
      row.complications ? `Complicaciones: ${row.complications}` : null,
      row.postOpNotes ? `Notas postoperatorias: ${row.postOpNotes}` : null,
      row.outcome ? `Resultado: ${row.outcome}` : null,
      row.hospitalStayDays !== null ? `Tiempo de hospitalización: ${row.hospitalStayDays} días` : null,
      row.surgeryDurationMinutes !== null ? `Tiempo quirúrgico: ${row.surgeryDurationMinutes} minutos` : null,
    ].filter((value): value is string => Boolean(value)).join('\n');
  }

  private importedClinicalFields(row: Parameters<typeof buildPatientInputFromRow>[0]): Record<string, unknown> {
    const fields = new Set([
      'consultationDate', 'consultationType', 'chiefComplaint', 'currentIllness', 'physicalExam',
      'assessment', 'diagnosisCodes', 'plan', 'followUpDate', 'followUpNotes', 'surgeryDate',
      'procedure', 'surgeryStatus', 'asa', 'anesthesiaType', 'surgeryDurationMinutes', 'technique',
      'findings', 'complications', 'postOpNotes', 'outcome', 'hospitalStayDays',
    ]);
    return Object.fromEntries(Object.entries(row.importedFields).filter(([key]) => fields.has(key)));
  }
}
