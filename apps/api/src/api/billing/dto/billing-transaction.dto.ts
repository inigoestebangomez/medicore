// apps/api/src/api/billing/dto/billing-transaction.dto.ts
import { z } from 'zod';

export const BillingTypeSchema = z.enum([
  'CONSULTATION', 'SURGERY', 'TREATMENT', 'SUBSCRIPTION', 'OTHER',
]);
export const BillingStatusSchema = z.enum(['PENDING', 'PAID', 'CANCELLED', 'REFUNDED']);

export const CreateBillingTransactionSchema = z.object({
  patientId: z.string().uuid().optional().nullable(),
  consultationId: z.string().uuid().optional().nullable(),
  surgeryId: z.string().uuid().optional().nullable(),
  amount: z.number().min(0),
  type: BillingTypeSchema.optional(),
  status: BillingStatusSchema.optional(),
  description: z.string().max(2000).optional().nullable(),
  date: z.string().datetime().optional(),
});
export type CreateBillingTransactionInput = z.infer<typeof CreateBillingTransactionSchema>;

export const ListBillingTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  type: BillingTypeSchema.optional(),
  status: BillingStatusSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type ListBillingTransactionsQuery = z.infer<typeof ListBillingTransactionsQuerySchema>;