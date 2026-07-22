// apps/api/src/api/pharma/dto/pharma.dto.ts
import { z } from 'zod';

export const InteractionTypeSchema = z.enum([
  'CALL', 'MEETING', 'EMAIL', 'LUNCH', 'CONFERENCE', 'OTHER',
]);

export const CreateContactSchema = z.object({
  name: z.string().min(1).max(300),
  company: z.string().min(1).max(300),
  role: z.string().max(200).optional().nullable(),
  email: z.string().email().max(300).optional().nullable(),
  phone: z.string().max(100).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  nextFollowUpAt: z.string().datetime().optional(),
});
export type CreateContactInput = z.infer<typeof CreateContactSchema>;

export const UpdateContactSchema = CreateContactSchema.partial();
export type UpdateContactInput = z.infer<typeof UpdateContactSchema>;

export const CreateInteractionSchema = z.object({
  type: InteractionTypeSchema.optional(),
  notes: z.string().max(5000).optional().nullable(),
  followUpNeeded: z.boolean().optional(),
  date: z.string().datetime().optional(),
});
export type CreateInteractionInput = z.infer<typeof CreateInteractionSchema>;

export const ListContactsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  company: z.string().optional(),
});
export type ListContactsQuery = z.infer<typeof ListContactsQuerySchema>;