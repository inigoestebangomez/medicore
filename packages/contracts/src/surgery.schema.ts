// packages/contracts/src/surgery.schema.ts
import { z } from 'zod';
import { ProcedureCodeSchema } from './consultation.schema.js';

// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────

export const SurgeryStatusSchema = z.enum([
  'SCHEDULED', 'COMPLETED', 'CANCELLED', 'POSTPONED',
]);
export type SurgeryStatus = z.infer<typeof SurgeryStatusSchema>;

export const AsaClassificationSchema = z.enum([
  'ASA_I', 'ASA_II', 'ASA_III', 'ASA_IV', 'ASA_V', 'ASA_VI',
]);
export type AsaClassification = z.infer<typeof AsaClassificationSchema>;

// ─────────────────────────────────────────────
// Allowed state transitions (domain reference)
// ─────────────────────────────────────────────

export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['COMPLETED', 'CANCELLED', 'POSTPONED'],
  POSTPONED: ['SCHEDULED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

// ─────────────────────────────────────────────
// CreateSurgery
// ─────────────────────────────────────────────

export const CreateSurgerySchema = z.object({
  date: z.string().datetime({ message: 'Invalid ISO datetime' }),
  procedureType: z.string().min(1).max(500),
  procedureCodes: z.array(ProcedureCodeSchema).max(20).optional(),
  asa: AsaClassificationSchema.optional(),
  anesthesiaType: z.string().optional(),
  preOpNotes: z.string().optional(),
  preOpChecklist: z.record(z.unknown()).optional(),
  duration: z.number().int().positive().optional(),
  technique: z.record(z.unknown()).optional(),
  findings: z.string().optional(),
  complications: z.string().optional(),
  postOpNotes: z.string().optional(),
  postOpProtocol: z.record(z.unknown()).optional(),
  outcome: z.string().optional(),
  generateReport: z.boolean().default(false),
});
export type CreateSurgeryInput = z.infer<typeof CreateSurgerySchema>;

// ─────────────────────────────────────────────
// UpdateSurgery (partial)
// ─────────────────────────────────────────────

export const UpdateSurgerySchema = z.object({
  date: z.string().datetime().optional(),
  procedureType: z.string().min(1).max(500).optional(),
  procedureCodes: z.array(ProcedureCodeSchema).max(20).optional(),
  asa: AsaClassificationSchema.optional().nullable(),
  anesthesiaType: z.string().optional().nullable(),
  preOpNotes: z.string().optional().nullable(),
  preOpChecklist: z.record(z.unknown()).optional().nullable(),
  duration: z.number().int().positive().optional().nullable(),
  technique: z.record(z.unknown()).optional().nullable(),
  findings: z.string().optional().nullable(),
  complications: z.string().optional().nullable(),
  postOpNotes: z.string().optional().nullable(),
  postOpProtocol: z.record(z.unknown()).optional().nullable(),
  outcome: z.string().optional().nullable(),
  editReason: z.string().min(1).max(2000).optional(),
});
export type UpdateSurgeryInput = z.infer<typeof UpdateSurgerySchema>;

// ─────────────────────────────────────────────
// ChangeSurgeryStatus
// ─────────────────────────────────────────────

export const ChangeSurgeryStatusSchema = z.object({
  targetStatus: SurgeryStatusSchema,
  asa: AsaClassificationSchema.optional(),
  date: z.string().datetime().optional(),
  statusReason: z.string().max(2000).optional(),
});
export type ChangeSurgeryStatusInput = z.infer<typeof ChangeSurgeryStatusSchema>;

// ─────────────────────────────────────────────
// SurgeryResponse
// ─────────────────────────────────────────────

export const SurgeryResponseSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  organizationId: z.string().uuid(),
  date: z.string(),
  status: SurgeryStatusSchema,
  procedureType: z.string(),
  procedureCodes: z.array(ProcedureCodeSchema).nullable(),
  asa: AsaClassificationSchema.nullable(),
  anesthesiaType: z.string().nullable(),
  preOpNotes: z.string().nullable(),
  preOpChecklist: z.record(z.unknown()).nullable(),
  duration: z.number().nullable(),
  technique: z.record(z.unknown()).nullable(),
  findings: z.string().nullable(),
  complications: z.string().nullable(),
  postOpNotes: z.string().nullable(),
  postOpProtocol: z.record(z.unknown()).nullable(),
  outcome: z.string().nullable(),
  editReason: z.string().nullable(),
  physicianId: z.string(),
  createdBy: z.string(),
  updatedBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  consentWarning: z.boolean().optional(),
  reportQueued: z.boolean().optional(),
});
export type SurgeryResponse = z.infer<typeof SurgeryResponseSchema>;

// ─────────────────────────────────────────────
// ListSurgeries query
// ─────────────────────────────────────────────

export const ListSurgeriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: SurgeryStatusSchema.optional(),
  sortBy: z.enum(['date', 'createdAt']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type ListSurgeriesQuery = z.infer<typeof ListSurgeriesQuerySchema>;