// packages/contracts/src/scale.schema.ts
import { z } from 'zod';

// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────

export const ClinicalScaleTypeSchema = z.enum([
  'SNOT_22',
  'VAS_TINNITUS',
  'DHI',
  'VHI',
  'RSI',
  'OSA_EPWORTH',
  'STOPBANG',
  'NOSE',
  'CUSTOM',
]);
export type ClinicalScaleType = z.infer<typeof ClinicalScaleTypeSchema>;

// ─────────────────────────────────────────────
// Per-scale score validation schemas (BR-SCA-001)
// ─────────────────────────────────────────────

export const Snot22ScoresSchema = z.record(z.string(), z.number().int().min(0).max(5))
  .refine(obj => Object.keys(obj).length === 22, { message: 'SNOT-22 requires exactly 22 items' });

export const VasTinnitusScoresSchema = z.record(z.string(), z.number().min(0).max(10))
  .refine(obj => Object.keys(obj).length >= 1, { message: 'VAS Tinnitus requires at least 1 item' });

export const DhiScoresSchema = z.record(z.string(), z.number().int().min(0).max(4))
  .refine(obj => Object.keys(obj).length === 25, { message: 'DHI requires exactly 25 items' });

export const VhiScoresSchema = z.record(z.string(), z.number().int().min(0).max(4))
  .refine(obj => Object.keys(obj).length >= 1, { message: 'VHI requires at least 1 item' });

export const RsiScoresSchema = z.record(z.string(), z.number().int().min(0).max(5))
  .refine(obj => Object.keys(obj).length >= 1, { message: 'RSI requires at least 1 item' });

export const OsaEpworthScoresSchema = z.record(z.string(), z.number().int().min(0).max(3))
  .refine(obj => Object.keys(obj).length === 8, { message: 'Epworth Sleepiness Scale requires exactly 8 items' });

export const StopbangScoresSchema = z.record(z.string(), z.number().int().min(0).max(1))
  .refine(obj => Object.keys(obj).length === 8, { message: 'STOP-BANG requires exactly 8 items' });

export const NoseScoresSchema = z.record(z.string(), z.number().int().min(0).max(4))
  .refine(obj => Object.keys(obj).length >= 1, { message: 'NOSE requires at least 1 item' });

export const CustomScoresSchema = z.record(z.string(), z.number())
  .refine(obj => Object.keys(obj).length >= 1, { message: 'CUSTOM scale requires at least 1 score item' });

// ─────────────────────────────────────────────
// Map scale type → validation schema
// ─────────────────────────────────────────────

export const ScaleTypeValidationMap: Record<ClinicalScaleType, z.ZodTypeAny> = {
  SNOT_22: Snot22ScoresSchema,
  VAS_TINNITUS: VasTinnitusScoresSchema,
  DHI: DhiScoresSchema,
  VHI: VhiScoresSchema,
  RSI: RsiScoresSchema,
  OSA_EPWORTH: OsaEpworthScoresSchema,
  STOPBANG: StopbangScoresSchema,
  NOSE: NoseScoresSchema,
  CUSTOM: CustomScoresSchema,
};

// ─────────────────────────────────────────────
// CreateScale
// ─────────────────────────────────────────────

export const CreateScaleSchema = z.object({
  consultationId: z.string().uuid().optional(),
  scaleType: ClinicalScaleTypeSchema,
  date: z.string().datetime({ message: 'Invalid ISO datetime' }).optional(),
  scores: z.record(z.string(), z.number()),
  notes: z.string().optional(),
});
export type CreateScaleInput = z.infer<typeof CreateScaleSchema>;

// ─────────────────────────────────────────────
// UpdateScale
// ─────────────────────────────────────────────

export const UpdateScaleSchema = z.object({
  scores: z.record(z.string(), z.number()).optional(),
  notes: z.string().optional().nullable(),
});
export type UpdateScaleInput = z.infer<typeof UpdateScaleSchema>;

// ─────────────────────────────────────────────
// ListScales query
// ─────────────────────────────────────────────

export const ListScalesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  scaleType: ClinicalScaleTypeSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type ListScalesQuery = z.infer<typeof ListScalesQuerySchema>;

// ─────────────────────────────────────────────
// ScaleResponse
// ─────────────────────────────────────────────

export const ScaleResponseSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  organizationId: z.string().uuid(),
  consultationId: z.string().uuid().nullable(),
  scaleType: ClinicalScaleTypeSchema,
  date: z.string(),
  scores: z.record(z.string(), z.number()),
  total: z.number(),
  notes: z.string().nullable(),
  createdBy: z.string(),
  updatedBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ScaleResponse = z.infer<typeof ScaleResponseSchema>;