// packages/contracts/src/patient.schema.ts
import { z } from 'zod';

// ─────────────────────────────────────────────
// Enums (mirrors Prisma)
// ─────────────────────────────────────────────

export const SexSchema = z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']);
export type Sex = z.infer<typeof SexSchema>;

export const IdDocumentTypeSchema = z.enum(['DNI', 'NIE', 'PASSPORT', 'OTHER']);
export type IdDocumentType = z.infer<typeof IdDocumentTypeSchema>;

export const BloodTypeSchema = z.enum([
  'A_POS', 'A_NEG', 'B_POS', 'B_NEG',
  'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN',
]);
export type BloodType = z.infer<typeof BloodTypeSchema>;

// ─────────────────────────────────────────────
// Shared pagination
// ─────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ─────────────────────────────────────────────
// CreatePatient
// ─────────────────────────────────────────────

export const CreatePatientSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  birthDate: z.string().refine(
    (val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && date <= new Date();
    },
    { message: 'birthDate must be a valid date not in the future' },
  ),
  sex: SexSchema,
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.record(z.unknown()).optional(),
  idDocument: z.string().optional(),
  idDocType: IdDocumentTypeSchema.optional(),
  nhc: z.string().optional(), // External NHC; auto-generated if not provided (BR-PAT-004)
  bloodType: BloodTypeSchema.optional(),
  notes: z.string().optional(),
});
export type CreatePatientInput = z.infer<typeof CreatePatientSchema>;

// ─────────────────────────────────────────────
// UpdatePatient (partial — nhc is immutable by design)
// ─────────────────────────────────────────────

export const UpdatePatientSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  birthDate: z.string().refine(
    (val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && date <= new Date();
    },
    { message: 'birthDate must be a valid date not in the future' },
  ).optional(),
  sex: SexSchema.optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.record(z.unknown()).nullable().optional(),
  idDocument: z.string().nullable().optional(),
  idDocType: IdDocumentTypeSchema.optional(),
  bloodType: BloodTypeSchema.optional(),
  notes: z.string().nullable().optional(),
});
export type UpdatePatientInput = z.infer<typeof UpdatePatientSchema>;

// ─────────────────────────────────────────────
// PatientResponse
// ─────────────────────────────────────────────

export const PatientResponseSchema = z.object({
  id: z.string().uuid(),
  nhc: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  birthDate: z.string(),
  sex: SexSchema,
  age: z.number().int().nonnegative(),
  isPediatric: z.boolean(),
  hasCriticalAllergy: z.boolean(),
  hasActiveAllergies: z.boolean(),
  // Sensitive fields — omitted for VIEWER role
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.record(z.unknown()).optional(),
  idDocument: z.string().optional(),
  idDocType: IdDocumentTypeSchema.optional(),
  bloodType: BloodTypeSchema.optional(),
  notes: z.string().optional(),
  emergencyContact: z.record(z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PatientResponse = z.infer<typeof PatientResponseSchema>;

// ─────────────────────────────────────────────
// SearchPatients
// ─────────────────────────────────────────────

export const SearchPatientsSchema = PaginationSchema.extend({
  query: z.string().min(1),
  sortBy: z.enum(['lastName', 'createdAt', 'nhc']).default('lastName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});
export type SearchPatientsInput = z.infer<typeof SearchPatientsSchema>;