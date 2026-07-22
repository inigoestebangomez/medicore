// packages/contracts/src/import.schema.ts
// Zod schemas for the Import Module (Phase 11).
// Mirrors Prisma ImportStatus enum + AI ColumnMappingProposal contract.

import { z } from 'zod';

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
  'custom', 'ignore',
]);
export type StandardField = z.infer<typeof StandardFieldSchema>;

export const ColumnMappingSchema = z.record(StandardFieldSchema);
export type ColumnMapping = z.infer<typeof ColumnMappingSchema>;

export const ColumnMappingProposalSchema = z.object({
  columnMapping: ColumnMappingSchema,
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

export const ConfirmMappingSchema = z.object({
  columnMapping: ColumnMappingSchema,
  customFieldNames: z.record(z.string()).default({}),
  junkRowIndices: z.array(z.number().int().min(0)).default([]),
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
  totalRows: z.number().int(),
  importedRows: z.number().int(),
  enrichedRows: z.number().int(),
  createdRows: z.number().int(),
  skippedRows: z.number().int(),
  pendingRows: z.number().int(),
  matches: z.array(PatientMatchSchema).optional(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});
export type ImportBatchResponse = z.infer<typeof ImportBatchResponseSchema>;

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