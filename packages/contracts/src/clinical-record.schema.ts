// packages/contracts/src/clinical-record.schema.ts
// Seven clinical categories: contracts for the clinical record projection.
// Spec: patient-seven-categories §1–§6

import { z } from 'zod';

// ─────────────────────────────────────────────
// Clinical Record Category (seven tabs)
// ─────────────────────────────────────────────

export const ClinicalRecordCategorySchema = z.enum([
  'patient-data',
  'history',
  'current-illness',
  'physical-exam',
  'complementary-tests',
  'diagnosis',
  'treatment',
]);
export type ClinicalRecordCategory = z.infer<typeof ClinicalRecordCategorySchema>;

// ─────────────────────────────────────────────
// Review State (provenance gate for OCR/imported data)
// ─────────────────────────────────────────────

export const ReviewStateSchema = z.enum(['UNREVIEWED', 'CONFIRMED', 'REJECTED']);
export type ReviewState = z.infer<typeof ReviewStateSchema>;

// ─────────────────────────────────────────────
// Provenance — tracks author, source, and review state
// ─────────────────────────────────────────────

export const ProvenanceSchema = z.object({
  sourceType: z.string().min(1), // "manual" | "import" | "ocr" | "dual-write"
  sourceId: z.string().uuid().optional(),
  authorId: z.string().uuid(),
  recordedAt: z.string().datetime(),
  reviewState: ReviewStateSchema.default('UNREVIEWED'),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

// ─────────────────────────────────────────────
// Age semantics (spec §1)
// ─────────────────────────────────────────────

/**
 * Full reference date for age calculation when birth date is absent.
 * Uses day/month/year — never fabricates a birth date.
 */
export const AgeReferenceDateSchema = z.object({
  day: z.number().int().min(1).max(31),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(1900).max(2100),
});
export type AgeReferenceDate = z.infer<typeof AgeReferenceDateSchema>;

// ─────────────────────────────────────────────
// History (Antecedentes) — spec §2
// ─────────────────────────────────────────────

export const HistoryEntryTypeSchema = z.enum([
  'PERSONAL',
  'ALLERGY',
  'SURGICAL',
  'TOXIC_HABIT',
  'PROFESSION',
  'FAMILY',
  'ECOG',
]);
export type HistoryEntryType = z.infer<typeof HistoryEntryTypeSchema>;

export const CreateHistoryEntrySchema = z.object({
  entryType: HistoryEntryTypeSchema,
  key: z.string().min(1).max(200),
  value: z.string().max(5000),
  provenance: ProvenanceSchema,
});
export type CreateHistoryEntryInput = z.infer<typeof CreateHistoryEntrySchema>;

export const HistoryEntryResponseSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  entryType: HistoryEntryTypeSchema,
  key: z.string(),
  value: z.string(),
  provenance: ProvenanceSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HistoryEntryResponse = z.infer<typeof HistoryEntryResponseSchema>;

// ─────────────────────────────────────────────
// Current Illness (Enfermedad actual) — spec §3
// ─────────────────────────────────────────────

export const DurationUnitSchema = z.enum(['HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'YEARS']);
export type DurationUnit = z.infer<typeof DurationUnitSchema>;

export const CreateCurrentIllnessSchema = z.object({
  symptoms: z.string().min(1).max(5000),
  durationValue: z.number().nonnegative().optional().nullable(),
  durationUnit: DurationUnitSchema.optional().nullable(),
  onset: z.string().datetime().optional().nullable(),
  evolution: z.string().max(5000).optional().nullable(),
  narrative: z.string().max(10000).optional().nullable(),
  consultationId: z.string().uuid().optional().nullable(),
  provenance: ProvenanceSchema,
});
export type CreateCurrentIllnessInput = z.infer<typeof CreateCurrentIllnessSchema>;

export const CurrentIllnessResponseSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  symptoms: z.string(),
  durationValue: z.number().nullable(),
  durationUnit: DurationUnitSchema.nullable(),
  onset: z.string().datetime().nullable(),
  evolution: z.string().nullable(),
  narrative: z.string().nullable(),
  consultationId: z.string().uuid().nullable(),
  provenance: ProvenanceSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CurrentIllnessResponse = z.infer<typeof CurrentIllnessResponseSchema>;

// ─────────────────────────────────────────────
// Physical Examination (Exploración física) — spec §4
// ─────────────────────────────────────────────

export const ExamTemplateFieldSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  type: z.enum(['TEXT', 'NUMBER', 'SELECT', 'BOOLEAN']),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(), // for SELECT type
});
export type ExamTemplateField = z.infer<typeof ExamTemplateFieldSchema>;

export const PhysicalExamTemplateSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  specialty: z.string().min(1).max(100),
  version: z.number().int().positive(),
  fields: z.array(ExamTemplateFieldSchema),
  createdAt: z.string().datetime(),
});
export type PhysicalExamTemplateResponse = z.infer<typeof PhysicalExamTemplateSchema>;

export const CustomFindingSchema = z.object({
  label: z.string().min(1).max(200),
  value: z.string().max(2000),
});
export type CustomFinding = z.infer<typeof CustomFindingSchema>;

export const CreatePhysicalExamRecordSchema = z.object({
  patientId: z.string().uuid(),
  templateId: z.string().uuid(),
  templateVersion: z.number().int().positive(),
  values: z.record(z.union([z.string(), z.number(), z.boolean()])),
  customFindings: z.array(CustomFindingSchema).optional(),
  consultationId: z.string().uuid().optional().nullable(),
  provenance: ProvenanceSchema,
});
export type CreatePhysicalExamRecordInput = z.infer<typeof CreatePhysicalExamRecordSchema>;

export const PhysicalExamRecordResponseSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  templateId: z.string().uuid(),
  templateVersion: z.number().int().positive(),
  templateSchemaSnapshot: z.unknown(),
  values: z.record(z.union([z.string(), z.number(), z.boolean()])),
  customFindings: z.array(CustomFindingSchema),
  consultationId: z.string().uuid().nullable(),
  provenance: ProvenanceSchema,
  createdAt: z.string().datetime(),
});
export type PhysicalExamRecordResponse = z.infer<typeof PhysicalExamRecordResponseSchema>;

// ─────────────────────────────────────────────
// Complementary Tests — Labs (spec §5)
// ─────────────────────────────────────────────

export const CreateLabReportSchema = z.object({
  patientId: z.string().uuid(),
  s3Key: z.string().min(1),
  fileName: z.string().min(1).max(500),
  ocrPayload: z.unknown().optional(),
  provenance: ProvenanceSchema,
});
export type CreateLabReportInput = z.infer<typeof CreateLabReportSchema>;

export const LabResultItemSchema = z.object({
  name: z.string().min(1).max(200),
  value: z.string().max(500),
  unit: z.string().max(50).optional(),
  referenceRange: z.string().max(100).optional(),
  reviewState: ReviewStateSchema.default('UNREVIEWED'),
});
export type LabResultItem = z.infer<typeof LabResultItemSchema>;

export const LabReportResponseSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  s3Key: z.string(),
  fileName: z.string(),
  ocrPayload: z.unknown().nullable(),
  results: z.array(LabResultItemSchema),
  overallReviewState: ReviewStateSchema,
  provenance: ProvenanceSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type LabReportResponse = z.infer<typeof LabReportResponseSchema>;

export const ConfirmLabResultsSchema = z.object({
  reportId: z.string().uuid(),
  results: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      reviewState: z.enum(['CONFIRMED', 'REJECTED']),
    }),
  ),
  reviewerId: z.string().uuid(),
});
export type ConfirmLabResultsInput = z.infer<typeof ConfirmLabResultsSchema>;

// ─────────────────────────────────────────────
// Diagnosis (Diagnóstico) — spec §6
// ─────────────────────────────────────────────

export const DiagnosisCodeSystemSchema = z.enum(['CIE-10-ES', 'SNOMED']);
export type DiagnosisCodeSystem = z.infer<typeof DiagnosisCodeSystemSchema>;

export const DiagnosisStatusSchema = z.enum(['ACTIVE', 'RESOLVED', 'DISCARDED']);
export type DiagnosisStatus = z.infer<typeof DiagnosisStatusSchema>;

export const CreateDiagnosisSchema = z.object({
  patientId: z.string().uuid(),
  system: DiagnosisCodeSystemSchema,
  code: z.string().min(1).max(50),
  description: z.string().min(1).max(1000),
  catalogVersion: z.string().min(1).max(50),
  status: DiagnosisStatusSchema.default('ACTIVE'),
  variables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  consultationId: z.string().uuid().optional().nullable(),
  provenance: ProvenanceSchema,
});
export type CreateDiagnosisInput = z.infer<typeof CreateDiagnosisSchema>;

export const DiagnosisResponseSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  system: DiagnosisCodeSystemSchema,
  code: z.string(),
  description: z.string(),
  catalogVersion: z.string(),
  status: DiagnosisStatusSchema,
  variables: z.record(z.union([z.string(), z.number(), z.boolean()])),
  consultationId: z.string().uuid().nullable(),
  provenance: ProvenanceSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DiagnosisResponse = z.infer<typeof DiagnosisResponseSchema>;

export const UpdateDiagnosisStatusSchema = z.object({
  status: z.enum(['RESOLVED', 'DISCARDED']),
  reviewerId: z.string().uuid(),
});
export type UpdateDiagnosisStatusInput = z.infer<typeof UpdateDiagnosisStatusSchema>;

// ─────────────────────────────────────────────
// Imaging — DICOM metadata extensions (spec §5)
// ─────────────────────────────────────────────

export const DicomMetadataSchema = z.object({
  studyInstanceUid: z.string().min(1),
  seriesInstanceUid: z.string().min(1).optional(),
  sopInstanceUid: z.string().min(1).optional(),
  modality: z.string().max(20).optional(),
  storageBackend: z.enum(['R2']).default('R2'),
  storageKey: z.string().min(1),
});
export type DicomMetadata = z.infer<typeof DicomMetadataSchema>;

// ─────────────────────────────────────────────
// Clinical Record Response (category query)
// ─────────────────────────────────────────────

export const ClinicalRecordResponseSchema = z.object({
  patientId: z.string().uuid(),
  category: ClinicalRecordCategorySchema,
  data: z.array(z.unknown()),
  totalCount: z.number().int().nonnegative(),
});
export type ClinicalRecordResponse = z.infer<typeof ClinicalRecordResponseSchema>;
