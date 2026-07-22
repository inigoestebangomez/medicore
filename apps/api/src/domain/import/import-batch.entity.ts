// apps/api/src/domain/import/import-batch.entity.ts
// Domain entity: ImportBatch — 5-stage pipeline state machine + counters + snapshot.
// PENDING → CONFIRMING → PROCESSING → COMPLETED/FAILED; revert from COMPLETED soft-deletes.

import type {
  ImportStatus,
  ColumnMapping,
  FileSample,
} from '@medicore/contracts';
import { IMPORT_ALLOWED_TRANSITIONS } from '@medicore/contracts';
import { InvalidImportTransitionError } from './errors/invalid-import-transition.error';
import { ImportAlreadyFinalizedError } from './errors/import-already-finalized.error';

export interface ImportBatchProps {
  id: string;
  organizationId: string;
  createdBy: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  originalFormat: 'xlsx' | 'csv' | 'tsv';

  // Sample of the original file (first 20 rows) for the UI.
  sample: FileSample;

  // Result of AI analysis.
  columnMapping: ColumnMapping;
  customFieldNames?: Record<string, string>;
  junkRowIndices?: number[];
  aiConfidence?: number | null;
  aiProvider?: 'heuristic' | 'groq' | 'claude' | null;
  issues?: string[];
  notes?: string | null;

  // Counters.
  totalRows?: number;
  importedRows?: number;
  enrichedRows?: number;
  createdRows?: number;
  skippedRows?: number;
  pendingRows?: number;

  // Snapshot of pre-import standard fields for revert (BR-IMP-005).
  snapshot?: Record<string, unknown> | null;

  status: ImportStatus;
  errorMessage?: string | null;

  createdAt?: Date;
  completedAt?: Date | null;
  deletedAt?: Date | null;
}

const TERMINAL_STATUSES: ReadonlySet<ImportStatus> = new Set<ImportStatus>([
  'COMPLETED', 'FAILED',
]);

export class ImportBatch {
  readonly id: string;
  readonly organizationId: string;
  readonly createdBy: string;
  readonly fileName: string;
  readonly fileSize: number;
  readonly fileHash: string;
  readonly originalFormat: 'xlsx' | 'csv' | 'tsv';

  readonly sample: FileSample;
  readonly columnMapping: ColumnMapping;
  readonly customFieldNames: Record<string, string>;
  readonly junkRowIndices: number[];
  readonly aiConfidence: number | null;
  readonly aiProvider: 'heuristic' | 'groq' | 'claude' | null;
  readonly issues: string[];
  readonly notes: string | null;

  readonly totalRows: number;
  readonly importedRows: number;
  readonly enrichedRows: number;
  readonly createdRows: number;
  readonly skippedRows: number;
  readonly pendingRows: number;

  readonly snapshot: Record<string, unknown> | null;

  readonly status: ImportStatus;
  readonly errorMessage: string | null;

  readonly createdAt: Date;
  readonly completedAt: Date | null;
  readonly deletedAt: Date | null;

  constructor(props: ImportBatchProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.createdBy = props.createdBy;
    this.fileName = props.fileName;
    this.fileSize = props.fileSize;
    this.fileHash = props.fileHash;
    this.originalFormat = props.originalFormat;
    this.sample = props.sample;
    this.columnMapping = props.columnMapping ?? {};
    this.customFieldNames = props.customFieldNames ?? {};
    this.junkRowIndices = props.junkRowIndices ?? [];
    this.aiConfidence = props.aiConfidence ?? null;
    this.aiProvider = props.aiProvider ?? null;
    this.issues = props.issues ?? [];
    this.notes = props.notes ?? null;
    this.totalRows = props.totalRows ?? 0;
    this.importedRows = props.importedRows ?? 0;
    this.enrichedRows = props.enrichedRows ?? 0;
    this.createdRows = props.createdRows ?? 0;
    this.skippedRows = props.skippedRows ?? 0;
    this.pendingRows = props.pendingRows ?? 0;
    this.snapshot = props.snapshot ?? null;
    this.status = props.status;
    this.errorMessage = props.errorMessage ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.completedAt = props.completedAt ?? null;
    this.deletedAt = props.deletedAt ?? null;
  }

  // ─────────────────────────────────────────────
  // Factory — Stage 1 entry point
  // ─────────────────────────────────────────────

  /**
   * Create a new pending ImportBatch before AI analysis runs.
   * BR-IMP-001: no data persists before physician confirmation — the batch starts
   * in PENDING and nothing touches Patient records until PROCESSING/finalize.
   */
  static createPending(props: {
    id: string;
    organizationId: string;
    createdBy: string;
    fileName: string;
    fileSize: number;
    fileHash: string;
    originalFormat: 'xlsx' | 'csv' | 'tsv';
    sample: FileSample;
    totalRows: number;
  }): ImportBatch {
    return new ImportBatch({
      id: props.id,
      organizationId: props.organizationId,
      createdBy: props.createdBy,
      fileName: props.fileName,
      fileSize: props.fileSize,
      fileHash: props.fileHash,
      originalFormat: props.originalFormat,
      sample: props.sample,
      columnMapping: {},
      totalRows: props.totalRows,
      status: 'PENDING',
    });
  }

  // ─────────────────────────────────────────────
  // State machine
  // ─────────────────────────────────────────────

  canTransitionTo(target: ImportStatus): boolean {
    return (IMPORT_ALLOWED_TRANSITIONS[this.status] ?? []).includes(target);
  }

  isTerminal(): boolean {
    return TERMINAL_STATUSES.has(this.status);
  }

  private assertTransition(target: ImportStatus): void {
    if (!this.canTransitionTo(target)) {
      if (this.isTerminal()) {
        throw new ImportAlreadyFinalizedError(this.status, `transition to ${target}`);
      }
      throw new InvalidImportTransitionError(this.status, target);
    }
  }

  /**
   * Stage 2 — AI analysis finished. Move to CONFIRMING with the proposed mapping.
   * Confirmed mapping is applied via `applyConfirmedMapping` after the physician edits.
   */
  toConfirming(proposal: {
    columnMapping: ColumnMapping;
    customFieldNames?: Record<string, string>;
    junkRowIndices?: number[];
    aiConfidence?: number | null;
    aiProvider?: 'heuristic' | 'groq' | 'claude' | null;
    issues?: string[];
    notes?: string | null;
    skippedRows?: number;
  }): ImportBatch {
    if (this.status === 'CONFIRMING') {
      // Allow updating the proposal while confirming (e.g. re-analysis).
      return new ImportBatch({ ...this, ...proposal });
    }
    this.assertTransition('CONFIRMING');
    return new ImportBatch({ ...this, status: 'CONFIRMING', ...proposal });
  }

  /**
   * Stage 2 (UI) — physician reviewed and possibly corrected the mapping,
   * junk rows and custom field names. Resolution still pending matches.
   */
  applyConfirmedMapping(input: {
    columnMapping: ColumnMapping;
    customFieldNames?: Record<string, string>;
    junkRowIndices?: number[];
  }): ImportBatch {
    if (this.isTerminal()) {
      throw new ImportAlreadyFinalizedError(this.status, 'apply confirmed mapping');
    }
    return new ImportBatch({
      ...this,
      status: 'CONFIRMING',
      columnMapping: input.columnMapping,
      customFieldNames: input.customFieldNames ?? this.customFieldNames,
      junkRowIndices: input.junkRowIndices ?? this.junkRowIndices,
    });
  }

  /**
   * Stage 5 — physician confirmed all match resolutions. Begin processing.
   * The snapshot is captured at this point for revert (BR-IMP-005).
   */
  startProcessing(snapshot: Record<string, unknown>): ImportBatch {
    this.assertTransition('PROCESSING');
    return new ImportBatch({
      ...this,
      status: 'PROCESSING',
      snapshot,
    });
  }

  /**
   * Stage 5 — finalize import. Sets final counters and COMPLETED status.
   */
  complete(counters: {
    importedRows: number;
    enrichedRows: number;
    createdRows: number;
    skippedRows: number;
    pendingRows: number;
  }): ImportBatch {
    this.assertTransition('COMPLETED');
    return new ImportBatch({
      ...this,
      status: 'COMPLETED',
      importedRows: counters.importedRows,
      enrichedRows: counters.enrichedRows,
      createdRows: counters.createdRows,
      skippedRows: counters.skippedRows,
      pendingRows: counters.pendingRows,
      completedAt: new Date(),
    });
  }

  /**
   * Marks the batch as FAILED with an error message.
   * Allowed from any non-terminal state.
   */
  fail(errorMessage: string): ImportBatch {
    if (this.status === 'FAILED') return this; // idempotent
    this.assertTransition('FAILED');
    return new ImportBatch({
      ...this,
      status: 'FAILED',
      errorMessage,
    });
  }

  // ─────────────────────────────────────────────
  // Revert (BR-IMP-005)
  // ─────────────────────────────────────────────

  /**
   * Soft-delete the batch on revert. Patients' importedData[batchId] is removed
   * by the repository; this just marks the batch as reverted (deletedAt).
   */
  revert(): ImportBatch {
    if (!this.isTerminal()) {
      // Revert is only valid on terminal batches. Use FAILED as a sentinel
      // target so the error surfaces the actionable status difference.
      throw new InvalidImportTransitionError(this.status, 'FAILED');
    }
    return new ImportBatch({ ...this, deletedAt: new Date() });
  }

  get isReverted(): boolean {
    return this.deletedAt !== null;
  }

  // ─────────────────────────────────────────────
  // Tier-limit hook (BR-IMP-006 — coded but not enforced)
  // ─────────────────────────────────────────────

  /**
   * Whether the file row count fits the org's tier.
   * BR-IMP-006: limits are coded here but enforcement is deferred — callers
   * may bypass with `IMPORT_LIMIT_BYPASS=1`. This is a pure predicate; the
   * enforcement decision belongs to the use case.
   */
  isWithinTierLimit(maxRowsForTier: number): boolean {
    return this.totalRows <= maxRowsForTier;
  }

  // ─────────────────────────────────────────────
  // Junk-detection helpers used by the cleanup stage
  // ─────────────────────────────────────────────

  get hasOnlyJunkRows(): boolean {
    return this.totalRows > 0 && this.skippedRows === this.totalRows;
  }
}