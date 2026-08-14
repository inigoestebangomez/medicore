// packages/contracts/src/import.schema.ts
// Zod schemas for the Import Module (Phase 11).
// Mirrors Prisma ImportStatus enum + AI ColumnMappingProposal contract.

import { z } from 'zod';

const ImportedScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const ImportedFieldsSchema = z.record(ImportedScalarSchema);

export const ImportedClinicalEventSchema = z.object({
  id: z.string().min(1),
  type: z.literal('import'),
  date: z.string().datetime({ offset: true }).nullable(),
  batchId: z.string().nullable(),
  batchName: z.string().nullable(),
  rowIndex: z.number().int().nullable(),
  rowIndices: z.array(z.number().int()),
  rowGranularity: z.enum(['single-row', 'merged-block', 'legacy-block']),
  importedAt: z.string().datetime({ offset: true }).nullable(),
  sourceFormat: z.enum(['xlsx', 'csv', 'tsv', 'unknown']),
  standardFields: ImportedFieldsSchema,
  customFields: ImportedFieldsSchema,
});
export type ImportedClinicalEvent = z.infer<typeof ImportedClinicalEventSchema>;

export const ImportedEventsPageSchema = z.object({
  version: z.literal('v1'),
  items: z.array(ImportedClinicalEventSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  truncated: z.boolean(),
});
export type ImportedEventsPage = z.infer<typeof ImportedEventsPageSchema>;

// ─────────────────────────────────────────────
// Enums (mirrors Prisma)
// ─────────────────────────────────────────────

export const ImportStatusSchema = z.enum([
  'PENDING', 'CONFIRMING', 'PROCESSING', 'COMPLETED', 'FAILED',
]);
export type ImportStatus = z.infer<typeof ImportStatusSchema>;

// Allowed status transitions (domain reference for ImportBatch state machine)
export const IMPORT_ALLOWED_TRANSITIONS: Record<ImportStatus, ImportStatus[]> = {
  PENDING: ['CONFIRMING', 'FAILED'],
  CONFIRMING: ['PROCESSING', 'COMPLETED', 'FAILED'],
  PROCESSING: ['COMPLETED', 'FAILED'],
  COMPLETED: ['FAILED'], // FAILED only on async revert error
  FAILED: [],
};

// ─────────────────────────────────────────────
// Column mapping — produced by the StructuredAnalysisProvider chain
// ─────────────────────────────────────────────

export const StandardFieldSchema = z.enum([
  'nhc', 'patientName', 'birthDate', 'age', 'sex',
  'admissionDate', 'diagnosis', 'procedure',
  'testType', 'requestDate', 'completionDate',
  'custom', 'ignore',
]);
export type StandardField = z.infer<typeof StandardFieldSchema>;

export const ColumnMappingSchema = z.record(StandardFieldSchema);
export type ColumnMapping = z.infer<typeof ColumnMappingSchema>;

const IDENTITY_MAPPING_FIELDS = ['nhc', 'patientName'] as const;

export const ColumnMappingConflictSchema = z.object({
  field: z.enum(IDENTITY_MAPPING_FIELDS),
  columns: z.array(z.string().min(1)).min(2),
  message: z.string().min(1),
});
export type ColumnMappingConflict = z.infer<typeof ColumnMappingConflictSchema>;

export interface ColumnMappingValidationResult {
  valid: boolean;
  conflicts: ColumnMappingConflict[];
}

export function formatColumnMappingConflict(
  field: ColumnMappingConflict['field'],
  columns: string[],
): string {
  const label = field === 'nhc' ? 'NHC' : 'Nombre del paciente';
  return `Hay varias columnas mapeadas a ${label}: ${columns.map((column) => `"${column}"`).join(', ')}. Cambia las columnas adicionales a Campo personalizado o Ignorar.`;
}

/** Validates the identity part of a column mapping without changing legacy payloads. */
export function validateColumnMapping(mapping: ColumnMapping): ColumnMappingValidationResult {
  const columnsByField = new Map<ColumnMappingConflict['field'], string[]>();
  for (const [column, field] of Object.entries(mapping)) {
    if (field !== 'nhc' && field !== 'patientName') continue;
    const columns = columnsByField.get(field) ?? [];
    columns.push(column);
    columnsByField.set(field, columns);
  }

  const conflicts = IDENTITY_MAPPING_FIELDS.flatMap((field) => {
    const columns = columnsByField.get(field) ?? [];
    return columns.length > 1
      ? [{ field, columns, message: formatColumnMappingConflict(field, columns) }]
      : [];
  });

  return { valid: conflicts.length === 0, conflicts };
}

export const ColumnMappingProposalSchema = z.object({
  columnMapping: ColumnMappingSchema,
  mappingConflicts: z.array(ColumnMappingConflictSchema).optional(),
  customFieldNames: z.record(z.string()).default({}),
  junkRowIndices: z.array(z.number().int().min(0)).default([]),
  issues: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  notes: z.string().default(''),
  provider: z.enum(['heuristic', 'groq', 'claude']).optional(),
});
export type ColumnMappingProposal = z.infer<typeof ColumnMappingProposalSchema>;

// File sample sent to providers (subset of the parsed file)
export const FileSampleSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.unknown())),
});
export type FileSample = z.infer<typeof FileSampleSchema>;

// ─────────────────────────────────────────────
// Parsed file shape (from FileParserService)
// ─────────────────────────────────────────────

export const ParsedFileSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.unknown())),
  sample: FileSampleSchema,
  totalRows: z.number().int().min(0),
  originalFormat: z.enum(['xlsx', 'csv', 'tsv']),
});
export type ParsedFile = z.infer<typeof ParsedFileSchema>;

// ─────────────────────────────────────────────
// Patient matching (PatientMatcherService output)
// ─────────────────────────────────────────────

export const MatchDecisionSchema = z.enum(['auto', 'confirm', 'new']);
export type MatchDecision = z.infer<typeof MatchDecisionSchema>;

export const PatientMatchSchema = z.object({
  rowIndex: z.number().int().min(0),
  candidateId: z.string().nullable(),
  score: z.number().min(0).max(100),
  decision: MatchDecisionSchema,
  reason: z.string(),
});
export type PatientMatch = z.infer<typeof PatientMatchSchema>;

// ─────────────────────────────────────────────
// API request bodies
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// SDD import-workflow-improvements — explicit discard & preview overrides
// ─────────────────────────────────────────────

/**
 * A column the physician explicitly marked as discarded. The column never
 * enters `importedData` (stripped by the cleaner before field-walk). The
 * optional reason is preserved for audit. Cap: 100 entries per batch.
 */
export const IgnoredColumnSchema = z.object({
  column: z.string().min(1).max(120),
  reason: z.string().max(200).optional(),
});
export type IgnoredColumn = z.infer<typeof IgnoredColumnSchema>;

/**
 * A complete row explicitly discarded by the physician. The row remains in
 * the normalized source for audit/preview, but never enters cleaning, matching
 * or finalization. Cap: 10,000 entries per batch.
 */
export const IgnoredRowSchema = z.object({
  rowIndex: z.number().int().min(0),
  reason: z.string().max(200).optional(),
});
export type IgnoredRow = z.infer<typeof IgnoredRowSchema>;

export const IgnoredRowsSchema = z.array(IgnoredRowSchema).max(10_000);

/**
 * Preview cell overrides keyed by 0-based rowIndex (stringified) → column →
 * value. Applied before cleaning overrides raw cell values. Cap: 200 entries.
 */
export const PreviewOverridesSchema = z
  .record(z.string().regex(/^\d+$/), z.record(z.string().min(1).max(120), z.unknown()))
  .refine((rec) => Object.keys(rec).length <= 200, {
    message: 'previewOverrides must contain at most 200 row entries',
  });
export type PreviewOverrides = z.infer<typeof PreviewOverridesSchema>;

/**
 * Per-cell discard: nullifies an individual cell. Values MUST be null — only
 * discard is expressible here, not arbitrary replacements (those are
 * previewOverrides). Cap: 1000 entries. `cellOverrides` > `previewOverrides`
 * > raw in the cleaner precedence.
 */
export const CellOverridesSchema = z
  .record(z.string().regex(/^\d+$/), z.record(z.string().min(1).max(120), z.null()))
  .superRefine((rec, ctx) => {
    const cellCount = Object.values(rec).reduce((count, cells) => count + Object.keys(cells).length, 0);
    if (cellCount > 1000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'cellOverrides must contain at most 1000 cell entries',
      });
    }
  });
export type CellOverrides = z.infer<typeof CellOverridesSchema>;

/**
 * Row classification entry — a non-junk row lands in exactly one bucket.
 * `rowIndex` is 0-based (backend contract); the UI renders 1-based labels.
 */
export const RowClassificationSchema = z.object({
  rowIndex: z.number().int().min(0),
  reason: z.string().optional(),
});
export type RowClassification = z.infer<typeof RowClassificationSchema>;

export const ConfirmMappingSchema = z.object({
  columnMapping: ColumnMappingSchema,
  customFieldNames: z.record(z.string()).default({}),
  junkRowIndices: z.array(z.number().int().min(0)).max(10_000).default([]),
  // SDD import-workflow-improvements — all optional for backward compatibility;
  // old clients that only send columnMapping still validate (defaults to empty).
  previewOverrides: PreviewOverridesSchema.optional(),
  ignoredColumns: z.array(IgnoredColumnSchema).max(100).optional(),
  ignoredRows: IgnoredRowsSchema.optional(),
  cellOverrides: CellOverridesSchema.optional(),
}).superRefine((value, ctx) => {
  for (const conflict of validateColumnMapping(value.columnMapping).conflicts) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['columnMapping'],
      message: conflict.message,
      params: { mappingConflicts: [conflict] },
    });
  }
});
export type ConfirmMappingInput = z.infer<typeof ConfirmMappingSchema>;

export const FinalizeImportSchema = z.object({
  // rowIndex -> decision ("auto" | "confirm" | "new")
  matchResolutions: z.record(z.string(), MatchDecisionSchema).default({}),
});
export type FinalizeImportInput = z.infer<typeof FinalizeImportSchema>;

// ─────────────────────────────────────────────
// API responses
// ─────────────────────────────────────────────

export const ImportBatchSummarySchema = z.object({
  aiConfidence: z.number().min(0).max(1).nullable(),
  totalRows: z.number().int(),
  importedRows: z.number().int(),
  enrichedRows: z.number().int(),
  createdRows: z.number().int(),
  skippedRows: z.number().int(),
  status: ImportStatusSchema,
  errorMessage: z.string().nullable(),
});
export type ImportBatchSummary = z.infer<typeof ImportBatchSummarySchema>;

export const ImportBatchResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  createdBy: z.string().uuid(),
  fileName: z.string(),
  fileSize: z.number().int(),
  originalFormat: z.enum(['xlsx', 'csv', 'tsv']),
  columnMapping: ColumnMappingSchema,
  customFieldNames: z.record(z.string()),
  junkRowIndices: z.array(z.number().int()),
  aiConfidence: z.number().nullable(),
  aiProvider: z.enum(['heuristic', 'groq', 'claude']).nullable(),
  issues: z.array(z.string()),
  notes: z.string().nullable(),
  sample: FileSampleSchema,
  status: ImportStatusSchema,
  errorMessage: z.string().nullable(),
  totalRows: z.number().int(),
  importedRows: z.number().int(),
  enrichedRows: z.number().int(),
  createdRows: z.number().int(),
  skippedRows: z.number().int(),
  pendingRows: z.number().int(),
  matches: z.array(PatientMatchSchema).optional(),
  // SDD import-workflow-improvements — row classification buckets + counts.
  // All optional/default for backward compatibility; legacy batches return [].
  fullIdentityRows: z.array(RowClassificationSchema).default([]),
  identityLightRows: z.array(RowClassificationSchema).default([]),
  unidentifiableRows: z.array(RowClassificationSchema).default([]),
  fullIdentityCount: z.number().int().default(0),
  identityLightCount: z.number().int().default(0),
  unidentifiableCount: z.number().int().default(0),
  junkRowCount: z.number().int().default(0),
  skippedRowCount: z.number().int().default(0),
  discardedRowCount: z.number().int().default(0),
  // Audit trail for explicit discard (persisted on ImportBatch).
  ignoredColumns: z.array(IgnoredColumnSchema).optional(),
  ignoredRows: IgnoredRowsSchema.optional(),
  previewOverrides: PreviewOverridesSchema.optional(),
  cellOverrides: CellOverridesSchema.optional(),
  normalizedRowsAvailable: z.boolean().optional(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});
export type ImportBatchResponse = z.infer<typeof ImportBatchResponseSchema>;

export const ImportPreviewRowSchema = z.object({
  rowIndex: z.number().int().min(0),
  values: z.record(z.string(), z.unknown()),
});
export type ImportPreviewRow = z.infer<typeof ImportPreviewRowSchema>;

export const ImportPreviewResponseSchema = z.object({
  batchId: z.string(),
  columns: z.array(z.string()),
  rows: z.array(ImportPreviewRowSchema),
  totalRows: z.number().int().min(0),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  source: z.enum(['cache', 'persisted']),
});
export type ImportPreviewResponse = z.infer<typeof ImportPreviewResponseSchema>;

export const ImportBatchHistoryItemSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  originalFormat: z.enum(['xlsx', 'csv', 'tsv']),
  status: ImportStatusSchema,
  errorMessage: z.string().nullable(),
  totalRows: z.number().int(),
  importedRows: z.number().int(),
  enrichedRows: z.number().int(),
  createdRows: z.number().int(),
  skippedRows: z.number().int(),
  // Explicitly discarded rows are tracked separately from automatic skips.
  // Default keeps history responses from older API versions valid.
  discardedRowCount: z.number().int().default(0),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});
export type ImportBatchHistoryItem = z.infer<typeof ImportBatchHistoryItemSchema>;

export const ImportHistoryResponseSchema = z.object({
  items: z.array(ImportBatchHistoryItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type ImportHistoryResponse = z.infer<typeof ImportHistoryResponseSchema>;

/**
 * Confirm-import response (Stages 2-4). Extends the legacy counts with the
 * SDD import-workflow-improvements row-classification buckets and counts so
 * the UI can render the per-bucket tabs and block finalize while unidentifiable
 * rows exist. Existing fields are preserved for backward compatibility.
 */
export const ConfirmImportResponseSchema = z.object({
  batchId: z.string().uuid(),
  totalRows: z.number().int(),
  cleanedRowCount: z.number().int(),
  junkRowCount: z.number().int().default(0),
  skippedRowCount: z.number().int().default(0),
  // Explicit physician discards never enter cleaned/importable/pending rows.
  discardedRowCount: z.number().int().default(0),
  matches: z.array(PatientMatchSchema).default([]),
  pendingResolutionCount: z.number().int().default(0),
  autoMatchCount: z.number().int().default(0),
  newPatientCount: z.number().int().default(0),
  // Row classification buckets (each non-junk row lands in exactly one).
  fullIdentityRows: z.array(RowClassificationSchema).default([]),
  identityLightRows: z.array(RowClassificationSchema).default([]),
  unidentifiableRows: z.array(RowClassificationSchema).default([]),
  fullIdentityCount: z.number().int().default(0),
  identityLightCount: z.number().int().default(0),
  unidentifiableCount: z.number().int().default(0),
});
export type ConfirmImportResponse = z.infer<typeof ConfirmImportResponseSchema>;

export const ListImportBatchesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: ImportStatusSchema.optional(),
});
export type ListImportBatchesQuery = z.infer<typeof ListImportBatchesQuerySchema>;

// ─────────────────────────────────────────────
// Tier limits (BR-IMP-006) — coded but NOT enforced initially
// ─────────────────────────────────────────────

export const IMPORT_TIER_LIMITS = {
  FREE: 500,
  PRO: Number.MAX_SAFE_INTEGER,       // unlimited
  ENTERPRISE: Number.MAX_SAFE_INTEGER, // unlimited
} as const;

export const IMPORT_LIMIT_BYPASS_ENV = 'IMPORT_LIMIT_BYPASS';
