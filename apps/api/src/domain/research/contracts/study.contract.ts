// apps/api/src/domain/research/contracts/study.contract.ts
// Zod schemas for the ResearchStudy aggregate (M8). Mirrors the Prisma
// ResearchStudy / StudyNotification models and the StudyStatus enum.
// BR-RES-008 (auto-recalculate), BR-RES-009 (freeze ownership), BR-RES-010
// (regression N≥10) are enforced downstream — these contracts only validate shape.

import { z } from 'zod';

export const StudyStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED', 'FROZEN']);
export type StudyStatusValue = z.infer<typeof StudyStatusSchema>;

export const StudyTypeSchema = z.enum(['QUERY', 'FORM', 'HYBRID']);
export type StudyTypeValue = z.infer<typeof StudyTypeSchema>;

export const CreateStudyInputSchema = z.object({
  queryId: z.string().min(1).nullable().optional(), // V4: optional for FORM studies
  studyType: StudyTypeSchema.default('QUERY'), // V4
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  publicationRef: z.string().max(500).optional(),
});
export type CreateStudyInput = z.infer<typeof CreateStudyInputSchema>;

export const UpdateStudyInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  publicationRef: z.string().max(500).nullable().optional(),
  analyses: z.array(z.unknown()).optional(),
});
export type UpdateStudyInput = z.infer<typeof UpdateStudyInputSchema>;

export const StudyResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  createdBy: z.string().uuid(),
  queryId: z.string().uuid().nullable(), // V4: nullable for FORM
  studyType: StudyTypeSchema.default('QUERY'), // V4
  name: z.string(),
  description: z.string().nullable(),
  status: StudyStatusSchema,
  cachedPatientIds: z.array(z.string()).default([]),
  cachedAt: z.string().datetime().nullable(),
  patientCount: z.number().int().default(0),
  analyses: z.array(z.unknown()).default([]),
  publicationRef: z.string().nullable(),
  frozenAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type StudyResponse = z.infer<typeof StudyResponseSchema>;

export const ListStudiesQuerySchema = z.object({
  status: StudyStatusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListStudiesQuery = z.infer<typeof ListStudiesQuerySchema>;

export const StudyNotificationResponseSchema = z.object({
  id: z.string().uuid(),
  studyId: z.string().uuid(),
  userId: z.string().uuid(),
  newPatientCount: z.number().int().default(0),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type StudyNotificationResponse = z.infer<typeof StudyNotificationResponseSchema>;

export const SuggestionTypeSchema = z.enum([
  'pre_post_available',
  'group_comparison_recommended',
  'sufficient_followup',
  'regression_feasible',
  'table_one_recommended',
]);
export type SuggestionType = z.infer<typeof SuggestionTypeSchema>;

export const SuggestionSchema = z.object({
  id: z.string(),
  type: SuggestionTypeSchema,
  rationale: z.string(),
  recommendedEndpoint: z.string().optional(),
  previewParams: z.record(z.string(), z.unknown()).optional(),
});
export type Suggestion = z.infer<typeof SuggestionSchema>;