// packages/contracts/src/research-form.schema.ts
// Zod schemas for the Research Engine V4 — Form Builder (REQ-FB-001..013).
// These mirror the V4 Prisma enums and models in apps/api/prisma/schema.prisma.
// All schemas are multi-tenant: organizationId and studyId validated where
// they originate from the request path/body.

import { z } from 'zod';

// ─────────────────────────────────────────────
// Enums (mirror Prisma V4 enums)
// ─────────────────────────────────────────────

export const StudyTypeSchema = z.enum(['QUERY', 'FORM', 'HYBRID']);
export type StudyType = z.infer<typeof StudyTypeSchema>;

export const VariableTypeSchema = z.enum([
  'CONTINUOUS',
  'DISCRETE',
  'DICHOTOMOUS',
  'NOMINAL',
  'ORDINAL',
  'TIME_TO_EVENT',
]);
export type VariableType = z.infer<typeof VariableTypeSchema>;

export const VariableScopeSchema = z.enum(['CORE', 'CUSTOM']);
export type VariableScope = z.infer<typeof VariableScopeSchema>;

export const AnalysisTestSchema = z.enum([
  'KAPPA', 'ICC', 'CRONBACH',
  'LOGISTIC', 'COX', 'KAPLAN_MEIER',
  'T_TEST', 'MANN_WHITNEY', 'CHI_SQUARE', 'FISHER',
  'ANOVA', 'PEARSON', 'SPEARMAN', 'WILCOXON', 'KRUSKAL',
]);
export type AnalysisTest = z.infer<typeof AnalysisTestSchema>;

export const RiskFactorLabelSchema = z.enum(['RISK_FACTOR', 'PROTECTIVE_FACTOR', 'NEUTRAL']);
export type RiskFactorLabel = z.infer<typeof RiskFactorLabelSchema>;

// ─────────────────────────────────────────────
// Variable options & range (per-type metadata) — REQ-FB-001
// ─────────────────────────────────────────────

export const VariableOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});
export type VariableOption = z.infer<typeof VariableOptionSchema>;

export const VariableRangeSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().default(1),
  })
  .optional();
export type VariableRange = z.infer<typeof VariableRangeSchema>;

// ─────────────────────────────────────────────
// StudyVariable — create/input (REQ-FB-001)
// Discriminated by `type` so NOMINAL/ORDINAL require options and
// CONTINUOUS/DISCRETE may carry range. DICHOTOMOUS stores options {Sí,No}.
// ─────────────────────────────────────────────

const baseVarFields = {
  name: z.string().min(1).max(200),
  label: z.string().min(1).max(200),
  scope: VariableScopeSchema.default('CUSTOM'),
  unit: z.string().max(50).optional(),
  required: z.boolean().default(false),
  isCore: z.boolean().default(false),
  position: z.number().int().min(0).default(0),
  parentId: z.string().uuid().nullable().optional(),
};

const ContinuousVarSchema = z.object({
  ...baseVarFields,
  type: z.literal('CONTINUOUS'),
  range: VariableRangeSchema,
  options: z.undefined(),
});
const DiscreteVarSchema = z.object({
  ...baseVarFields,
  type: z.literal('DISCRETE'),
  range: VariableRangeSchema,
  options: z.undefined(),
});
const DichotomousVarSchema = z.object({
  ...baseVarFields,
  type: z.literal('DICHOTOMOUS'),
  // DICHOTOMOUS defaults to {Sí,No} options, but accepts custom pairs.
  options: z.array(VariableOptionSchema).min(1).max(2).optional(),
  range: z.undefined(),
});
const NominalVarSchema = z.object({
  ...baseVarFields,
  type: z.literal('NOMINAL'),
  // REQ-FB-001 scenario: reject NOMINAL without options.
  options: z.array(VariableOptionSchema).min(1),
  range: z.undefined(),
});
const OrdinalVarSchema = z.object({
  ...baseVarFields,
  type: z.literal('ORDINAL'),
  options: z.array(VariableOptionSchema).min(1),
  range: z.undefined(),
});
const TimeToEventVarSchema = z.object({
  ...baseVarFields,
  type: z.literal('TIME_TO_EVENT'),
  unit: z.string().max(50).optional(), // time unit (days/months)
  options: z.undefined(),
  range: z.undefined(),
});

export const StudyVariableInputSchema = z.discriminatedUnion('type', [
  ContinuousVarSchema,
  DiscreteVarSchema,
  DichotomousVarSchema,
  NominalVarSchema,
  OrdinalVarSchema,
  TimeToEventVarSchema,
]);
export type StudyVariableInput = z.infer<typeof StudyVariableInputSchema>;

// Update is partial; type immutable post-create.
export const StudyVariableUpdateSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  unit: z.string().max(50).nullable().optional(),
  required: z.boolean().optional(),
  isCore: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
  options: z.array(VariableOptionSchema).nullable().optional(),
  range: VariableRangeSchema.nullable(),
});
export type StudyVariableUpdate = z.infer<typeof StudyVariableUpdateSchema>;

// Response (loose on options/range JSONB).
export const StudyVariableResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  studyId: z.string().uuid(),
  name: z.string(),
  label: z.string(),
  type: VariableTypeSchema,
  scope: VariableScopeSchema,
  unit: z.string().nullable(),
  required: z.boolean(),
  isCore: z.boolean(),
  position: z.number().int(),
  options: z.array(VariableOptionSchema).nullable(),
  range: VariableRangeSchema.nullable(),
  parentId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type StudyVariableResponse = z.infer<typeof StudyVariableResponseSchema>;

// ─────────────────────────────────────────────
// Reorder — REQ-FB-004
// ─────────────────────────────────────────────

export const ReorderVariablesInputSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});
export type ReorderVariablesInput = z.infer<typeof ReorderVariablesInputSchema>;

// ─────────────────────────────────────────────
// Decompose composite → N DICHOTOMOUS children — REQ-FB-005
// ─────────────────────────────────────────────

export const ChildSpecSchema = z.object({
  name: z.string().min(1).max(200),
  label: z.string().min(1).max(200),
});
export type ChildSpec = z.infer<typeof ChildSpecSchema>;

export const DecomposeInputSchema = z.object({
  parentVariableId: z.string().uuid(),
  children: z.array(ChildSpecSchema).min(1),
});
export type DecomposeInput = z.infer<typeof DecomposeInputSchema>;

// ─────────────────────────────────────────────
// VariableTemplate — reusable org library (REQ-FB-002)
// ─────────────────────────────────────────────

export const VariableTemplateInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: VariableTypeSchema,
  unit: z.string().max(50).optional(),
  options: z.array(VariableOptionSchema).nullable(),
  range: VariableRangeSchema.nullable(),
});
export type VariableTemplateInput = z.infer<typeof VariableTemplateInputSchema>;

export const VariableTemplateResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  createdBy: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  type: VariableTypeSchema,
  unit: z.string().nullable(),
  options: z.array(VariableOptionSchema).nullable(),
  range: VariableRangeSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type VariableTemplateResponse = z.infer<typeof VariableTemplateResponseSchema>;

export const AddFromTemplateInputSchema = z.object({
  templateId: z.string().uuid(),
});
export type AddFromTemplateInput = z.infer<typeof AddFromTemplateInputSchema>;

// ─────────────────────────────────────────────
// StudySubject — patient registration (REQ-FB-006)
// ─────────────────────────────────────────────

export const StudySubjectInputSchema = z.object({
  patientId: z.string().uuid().nullable().optional(),
  patientNhc: z.string().min(1).max(100),
  values: z.record(z.string(), z.unknown()).default({}),
  autoFillMap: z.record(z.string(), z.string()).default({}),
});
export type StudySubjectInput = z.infer<typeof StudySubjectInputSchema>;

export const StudySubjectResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  studyId: z.string().uuid(),
  patientId: z.string().uuid().nullable(),
  patientNhc: z.string(),
  values: z.record(z.string(), z.unknown()),
  autoFillMap: z.record(z.string(), z.string()),
  enrolledBy: z.string().uuid(),
  enrolledAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type StudySubjectResponse = z.infer<typeof StudySubjectResponseSchema>;

export const StudySubjectUpdateSchema = z.object({
  values: z.record(z.string(), z.unknown()).optional(),
  autoFillMap: z.record(z.string(), z.string()).optional(),
  patientNhc: z.string().min(1).max(100).optional(),
  patientId: z.string().uuid().nullable().optional(),
});
export type StudySubjectUpdate = z.infer<typeof StudySubjectUpdateSchema>;

// ─────────────────────────────────────────────
// EHR auto-fill preview (REQ-FB-009)
// ─────────────────────────────────────────────

export const AutoFillPreviewInputSchema = z.object({
  patientId: z.string().uuid(),
  autoFillMap: z.record(z.string(), z.string()).default({}),
});
export type AutoFillPreviewInput = z.infer<typeof AutoFillPreviewInputSchema>;

export const AutoFillPreviewSchema = z.object({
  overrides: z.record(z.string(), z.unknown()),
});
export type AutoFillPreview = z.infer<typeof AutoFillPreviewSchema>;

export const UpdateAutoFillMapInputSchema = z.object({
  autoFillMap: z.record(z.string(), z.string()),
  // Fields to opt OUT of auto-fill (per study per field) — empty array = opt-in all.
  optOutFields: z.array(z.string()).default([]),
});
export type UpdateAutoFillMapInput = z.infer<typeof UpdateAutoFillMapInputSchema>;

// ─────────────────────────────────────────────
// StatisticalAnalysis — run + list (REQ-FB-010, REQ-FB-011, REQ-FB-012)
// ─────────────────────────────────────────────

export const RunAnalysisInputSchema = z.object({
  test: AnalysisTestSchema,
  variableIds: z.array(z.string().uuid()).min(1),
  params: z.record(z.string(), z.unknown()).default({}),
  // Optional subject filter; null/absent = all enrolled subjects.
  subjectIds: z.array(z.string().uuid()).nullable().optional(),
});
export type RunAnalysisInput = z.infer<typeof RunAnalysisInputSchema>;

export const StatisticalAnalysisResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  studyId: z.string().uuid(),
  test: AnalysisTestSchema,
  variableIds: z.array(z.string().uuid()),
  params: z.record(z.string(), z.unknown()),
  statistic: z.number().nullable(),
  pValue: z.number().nullable(),
  ci95: z
    .object({ lower: z.number(), upper: z.number() })
    .nullable(),
  effectSize: z
    .object({ name: z.string(), or: z.number().nullable(), hr: z.number().nullable(), value: z.number().nullable() })
    .nullable(),
  n: z.number().int(),
  riskLabel: RiskFactorLabelSchema.nullable(),
  executedAt: z.string().datetime(),
});
export type StatisticalAnalysisResponse = z.infer<typeof StatisticalAnalysisResponseSchema>;

// ─────────────────────────────────────────────
// Registration form (REQ-FB-007) — produced by variableFormMapper; validated
// against FormTemplateSchema from form-schema.schema.ts at the boundary.
// ─────────────────────────────────────────────

export const RegistrationFormResponseSchema = z.object({
  studyId: z.string().uuid(),
  template: z.unknown(), // FormTemplate; validated elsewhere against FormTemplateSchema
});
export type RegistrationFormResponse = z.infer<typeof RegistrationFormResponseSchema>;

// ─────────────────────────────────────────────
// Agreement-test specific payloads (Kappa/ICC/Cronbach) — shape into Python stats
// ─────────────────────────────────────────────

export const KappaInputSchema = z.object({
  raterA: z.array(z.union([z.string(), z.number(), z.boolean()])),
  raterB: z.array(z.union([z.string(), z.number(), z.boolean()])),
  alpha: z.number().default(0.05),
});
export type KappaInput = z.infer<typeof KappaInputSchema>;

export const IccInputSchema = z.object({
  valuesByRater: z.array(z.array(z.number())),
  alpha: z.number().default(0.05),
});
export type IccInput = z.infer<typeof IccInputSchema>;

export const CronbachInputSchema = z.object({
  itemsBySubject: z.array(z.array(z.number())),
  alpha: z.number().default(0.05),
});
export type CronbachInput = z.infer<typeof CronbachInputSchema>;