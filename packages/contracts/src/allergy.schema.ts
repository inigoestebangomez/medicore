// packages/contracts/src/allergy.schema.ts
import { z } from 'zod';

// ─────────────────────────────────────────────
// Enums (mirrors Prisma)
// ─────────────────────────────────────────────

export const AllergySeveritySchema = z.enum(['MILD', 'MODERATE', 'SEVERE', 'ANAPHYLAXIS']);
export type AllergySeverity = z.infer<typeof AllergySeveritySchema>;

export const AllergyStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'UNCONFIRMED']);
export type AllergyStatus = z.infer<typeof AllergyStatusSchema>;

// ─────────────────────────────────────────────
// CreateAllergy
// ─────────────────────────────────────────────

export const CreateAllergySchema = z.object({
  substance: z.string().min(1).max(200),
  severity: AllergySeveritySchema,
  status: AllergyStatusSchema.default('ACTIVE'),
  reaction: z.string().optional(),
  substanceCode: z.string().optional(), // SNOMED CT code
  onsetDate: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateAllergyInput = z.infer<typeof CreateAllergySchema>;

// ─────────────────────────────────────────────
// UpdateAllergy
// ─────────────────────────────────────────────

export const UpdateAllergySchema = z.object({
  substance: z.string().min(1).max(200).optional(),
  severity: AllergySeveritySchema.optional(),
  status: AllergyStatusSchema.optional(),
  reaction: z.string().nullable().optional(),
  substanceCode: z.string().nullable().optional(),
  onsetDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type UpdateAllergyInput = z.infer<typeof UpdateAllergySchema>;

// ─────────────────────────────────────────────
// AllergyResponse
// ─────────────────────────────────────────────

export const AllergyResponseSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  substance: z.string(),
  substanceCode: z.string().optional(),
  reaction: z.string().optional(),
  severity: AllergySeveritySchema,
  status: AllergyStatusSchema,
  onsetDate: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AllergyResponse = z.infer<typeof AllergyResponseSchema>;