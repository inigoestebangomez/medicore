// packages/contracts/src/medication.schema.ts
import { z } from 'zod';

// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────

export const MedicationStatusSchema = z.enum([
  'ACTIVE', 'DISCONTINUED', 'COMPLETED', 'ON_HOLD',
]);
export type MedicationStatus = z.infer<typeof MedicationStatusSchema>;

// ─────────────────────────────────────────────
// Allowed state transitions (domain reference)
// ─────────────────────────────────────────────

export const MEDICATION_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ['DISCONTINUED', 'COMPLETED', 'ON_HOLD'],
  ON_HOLD: ['ACTIVE', 'DISCONTINUED'],
  DISCONTINUED: [],  // terminal
  COMPLETED: [],     // terminal
};

// ─────────────────────────────────────────────
// CreatePrescription
// ─────────────────────────────────────────────

export const CreatePrescriptionSchema = z.object({
  consultationId: z.string().uuid().optional(),
  drugName: z.string().min(1).max(500),
  drugCode: z.string().optional(),
  activeIngredient: z.string().optional(),
  dosage: z.string().min(1).max(200),
  frequency: z.string().min(1).max(200),
  route: z.string().optional(),
  form: z.string().optional(),
  startDate: z.string().datetime({ message: 'Invalid ISO datetime' }),
  endDate: z.string().datetime().optional().nullable(),
  duration: z.string().optional(),
  instructions: z.string().optional(),
  reason: z.string().optional(),
});
export type CreatePrescriptionInput = z.infer<typeof CreatePrescriptionSchema>;

// ─────────────────────────────────────────────
// DiscontinuePrescription
// ─────────────────────────────────────────────

export const DiscontinuePrescriptionSchema = z.object({
  discontinuationReason: z.string().min(1).max(2000),
});
export type DiscontinuePrescriptionInput = z.infer<typeof DiscontinuePrescriptionSchema>;

// ─────────────────────────────────────────────
// ListMedications query
// ─────────────────────────────────────────────

export const ListMedicationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: MedicationStatusSchema.optional(),
});
export type ListMedicationsQuery = z.infer<typeof ListMedicationsQuerySchema>;

// ─────────────────────────────────────────────
// MedicationResponse
// ─────────────────────────────────────────────

export const MedicationResponseSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  organizationId: z.string().uuid(),
  consultationId: z.string().uuid().nullable(),
  physicianId: z.string(),
  drugName: z.string(),
  drugCode: z.string().nullable(),
  activeIngredient: z.string().nullable(),
  dosage: z.string(),
  frequency: z.string(),
  route: z.string().nullable(),
  form: z.string().nullable(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  duration: z.string().nullable(),
  status: MedicationStatusSchema,
  instructions: z.string().nullable(),
  reason: z.string().nullable(),
  discontinuationReason: z.string().nullable(),
  createdBy: z.string(),
  updatedBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  allergyWarning: z.object({
    level: z.enum(['CRITICAL', 'SEVERE', 'MODERATE', 'MILD']),
    substances: z.array(z.string()),
  }).optional(),
  duplicationWarning: z.boolean().optional(),
});
export type MedicationResponse = z.infer<typeof MedicationResponseSchema>;