// packages/contracts/src/consultation.schema.ts
import { z } from 'zod';

// ─────────────────────────────────────────────
// Enums (mirrors Prisma)
// ─────────────────────────────────────────────

export const ConsultationTypeSchema = z.enum([
  'FIRST_VISIT', 'FOLLOW_UP', 'URGENCY', 'POST_OP', 'TELECONSULTATION',
]);
export type ConsultationType = z.infer<typeof ConsultationTypeSchema>;

// ─────────────────────────────────────────────
// Diagnosis codes
// ─────────────────────────────────────────────

export const DiagnosisCodeSchema = z.object({
  system: z.enum(['ICD10', 'SNOMED']),
  code: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(['primary', 'secondary', 'differential']),
  notes: z.string().optional(),
});
export type DiagnosisCode = z.infer<typeof DiagnosisCodeSchema>;

export const DiagnosisCodesArraySchema = z.array(DiagnosisCodeSchema)
  .max(10, 'Maximum 10 diagnosis codes allowed')
  .refine(
    arr => arr.filter(c => c.type === 'primary').length <= 1,
    'Only one primary diagnosis allowed',
  );

// ─────────────────────────────────────────────
// Procedure codes
// ─────────────────────────────────────────────

export const ProcedureCodeSchema = z.object({
  system: z.enum(['ICD10PCS', 'SNOMED', 'CPT']),
  code: z.string().min(1),
  description: z.string().min(1),
  laterality: z.enum(['left', 'right', 'bilateral', 'na']).optional(),
  notes: z.string().optional(),
});
export type ProcedureCode = z.infer<typeof ProcedureCodeSchema>;

// ─────────────────────────────────────────────
// CreateConsultation
// ─────────────────────────────────────────────

export const CreateConsultationSchema = z.object({
  date: z.string().datetime({ message: 'Invalid ISO datetime' }),
  type: ConsultationTypeSchema.default('FIRST_VISIT'),
  chiefComplaint: z.string().min(3).max(2000),
  currentIllness: z.string().optional(),
  physicalExam: z.record(z.unknown()).optional(),
  assessment: z.string().optional(),
  diagnosisCodes: DiagnosisCodesArraySchema.optional(),
  plan: z.string().optional(),
  procedureCodes: z.array(ProcedureCodeSchema).max(10).optional(),
  followUpDate: z.string().datetime().optional(),
  followUpNotes: z.string().optional(),
  generateReport: z.boolean().default(false),
})
  .refine(
    data => new Date(data.date) <= new Date(Date.now() + 24 * 60 * 60 * 1000),
    { message: 'Consultation date cannot be more than 24 hours in the future', path: ['date'] },
  );
export type CreateConsultationInput = z.infer<typeof CreateConsultationSchema>;

// ─────────────────────────────────────────────
// UpdateConsultation (partial)
// ─────────────────────────────────────────────

export const UpdateConsultationSchema = z.object({
  date: z.string().datetime().optional(),
  type: ConsultationTypeSchema.optional(),
  chiefComplaint: z.string().min(3).max(2000).optional(),
  currentIllness: z.string().optional().nullable(),
  physicalExam: z.record(z.unknown()).optional().nullable(),
  assessment: z.string().optional().nullable(),
  diagnosisCodes: DiagnosisCodesArraySchema.optional(),
  plan: z.string().optional().nullable(),
  procedureCodes: z.array(ProcedureCodeSchema).max(10).optional(),
  followUpDate: z.string().datetime().optional().nullable(),
  followUpNotes: z.string().optional().nullable(),
})
  .refine(
    data => {
      if (data.date) {
        return new Date(data.date) <= new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
      return true;
    },
    { message: 'Consultation date cannot be more than 24 hours in the future', path: ['date'] },
  );
export type UpdateConsultationInput = z.infer<typeof UpdateConsultationSchema>;

// ─────────────────────────────────────────────
// ConsultationResponse
// ─────────────────────────────────────────────

export const ConsultationResponseSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  organizationId: z.string().uuid(),
  date: z.string(),
  type: ConsultationTypeSchema,
  physicianId: z.string(),
  physicianName: z.string().optional(),
  chiefComplaint: z.string(),
  currentIllness: z.string().nullable(),
  physicalExam: z.record(z.unknown()).nullable(),
  assessment: z.string().nullable(),
  diagnosisCodes: z.array(DiagnosisCodeSchema).nullable(),
  plan: z.string().nullable(),
  procedureCodes: z.array(ProcedureCodeSchema).nullable(),
  followUpDate: z.string().nullable(),
  followUpNotes: z.string().nullable(),
  createdBy: z.string(),
  updatedBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ConsultationResponse = z.infer<typeof ConsultationResponseSchema>;

// ─────────────────────────────────────────────
// ListConsultations query
// ─────────────────────────────────────────────

export const ListConsultationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  type: ConsultationTypeSchema.optional(),
  sortBy: z.enum(['date', 'createdAt']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type ListConsultationsQuery = z.infer<typeof ListConsultationsQuerySchema>;

// ─────────────────────────────────────────────
// ConsultationListItem (subset for list views)
// ─────────────────────────────────────────────

export const ConsultationListItemSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  date: z.string(),
  type: ConsultationTypeSchema,
  physicianId: z.string(),
  physicianName: z.string().optional(),
  chiefComplaint: z.string(),
  createdAt: z.string(),
});
export type ConsultationListItem = z.infer<typeof ConsultationListItemSchema>;

// ─────────────────────────────────────────────
// SearchConsultationLogs
// ─────────────────────────────────────────────

export const SearchConsultationLogsSchema = z.object({
  query: z.string().min(1),
  field: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type SearchConsultationLogs = z.infer<typeof SearchConsultationLogsSchema>;