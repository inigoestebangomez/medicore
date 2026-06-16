// packages/contracts/src/organization.schema.ts
import { z } from 'zod';

export const OrganizationTypeSchema = z.enum(['CLINIC', 'SOLO_PRACTICE', 'HOSPITAL_DEPT']);
export type OrganizationType = z.infer<typeof OrganizationTypeSchema>;

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
  type: OrganizationTypeSchema,
  logoUrl: z.string().url().optional(),
});
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  settings: z.record(z.unknown()).optional(),
  logoUrl: z.string().url().nullable().optional(),
});
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;

export const OrganizationSchema = CreateOrganizationSchema.extend({
  id: z.string().uuid(),
  slug: z.string(),
  plan: z.enum(['FREE', 'PRO', 'ENTERPRISE']),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OrganizationResponse = z.infer<typeof OrganizationSchema>;