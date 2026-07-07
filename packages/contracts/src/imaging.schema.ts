// packages/contracts/src/imaging.schema.ts
import { z } from 'zod';

// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────

export const ImagingStudyTypeSchema = z.enum([
  'CT_SCAN',
  'MRI',
  'XRAY',
  'ENDOSCOPY',
  'NASOFIBROSCOPY',
  'LARYNGOSCOPY',
  'AUDIOGRAM',
  'TYMPANOGRAM',
  'ABR',
  'VIDEONYSTAGMOGRAPHY',
  'VHIT',
  'ULTRASOUND',
  'OTHER',
]);
export type ImagingStudyType = z.infer<typeof ImagingStudyTypeSchema>;

// ─────────────────────────────────────────────
// CreateImagingStudy
// ─────────────────────────────────────────────

export const CreateImagingStudySchema = z.object({
  type: ImagingStudyTypeSchema,
  date: z.string().datetime({ message: 'Invalid ISO datetime' }),
  description: z.string().max(2000).optional(),
  surgeryId: z.string().uuid().optional().nullable(),
  consultationId: z.string().uuid().optional().nullable(),
});
export type CreateImagingStudyInput = z.infer<typeof CreateImagingStudySchema>;

// ─────────────────────────────────────────────
// UpdateImagingStudy (partial)
// ─────────────────────────────────────────────

export const UpdateImagingStudySchema = z.object({
  type: ImagingStudyTypeSchema.optional(),
  date: z.string().datetime().optional(),
  description: z.string().max(2000).optional().nullable(),
  findings: z.string().max(10000).optional().nullable(),
  labels: z.array(z.object({
    label: z.string(),
    coordinates: z.record(z.unknown()).optional(),
  })).optional().nullable(),
  surgeryId: z.string().uuid().optional().nullable(),
  consultationId: z.string().uuid().optional().nullable(),
});
export type UpdateImagingStudyInput = z.infer<typeof UpdateImagingStudySchema>;

// ─────────────────────────────────────────────
// ListImagingStudies query
// ─────────────────────────────────────────────

export const ListImagingStudiesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  type: ImagingStudyTypeSchema.optional(),
  sortBy: z.enum(['date', 'createdAt']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type ListImagingStudiesQuery = z.infer<typeof ListImagingStudiesQuerySchema>;

// ─────────────────────────────────────────────
// FileMetadata
// ─────────────────────────────────────────────

export const FileMetadataSchema = z.object({
  key: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  uploadedAt: z.string(),
});
export type FileMetadata = z.infer<typeof FileMetadataSchema>;

// ─────────────────────────────────────────────
// Upload response
// ─────────────────────────────────────────────

export const UploadFilesResponseSchema = z.object({
  studyId: z.string().uuid(),
  filesAdded: z.number().int().nonnegative(),
  files: z.array(FileMetadataSchema),
});
export type UploadFilesResponse = z.infer<typeof UploadFilesResponseSchema>;

// ─────────────────────────────────────────────
// Presigned URL response
// ─────────────────────────────────────────────

export const PresignedUrlResponseSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string().datetime(),
});
export type PresignedUrlResponse = z.infer<typeof PresignedUrlResponseSchema>;

// ─────────────────────────────────────────────
// PendingDeletion
// ─────────────────────────────────────────────

export const PendingDeletionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  entityType: z.string(),
  entityId: z.string().uuid(),
  fileKey: z.string(),
  scheduledAt: z.string().datetime(),
  processedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type PendingDeletionResponse = z.infer<typeof PendingDeletionSchema>;