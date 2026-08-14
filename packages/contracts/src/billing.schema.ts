// packages/contracts/src/billing.schema.ts
import { z } from 'zod';

// Mirrors apps/api Prisma enums
export const PlanTypeSchema = z.enum(['FREE', 'PRO', 'ENTERPRISE']);
export type PlanType = z.infer<typeof PlanTypeSchema>;

export const BillingIntervalSchema = z.enum(['MONTHLY', 'YEARLY']);
export type BillingInterval = z.infer<typeof BillingIntervalSchema>;

/** POST /v1/billing/checkout */
export const CreateCheckoutSchema = z.object({
  billingInterval: BillingIntervalSchema,
});
export type CreateCheckoutInput = z.infer<typeof CreateCheckoutSchema>;

/** POST /v1/billing/portal — no body */
export const CreatePortalSchema = z.object({}).optional();
export type CreatePortalInput = z.infer<typeof CreatePortalSchema>;

/** PATCH /v1/billing/transactions/:id */
export const BillingTransactionTypeSchema = z.enum([
  'CONSULTATION',
  'SURGERY',
  'TREATMENT',
  'SUBSCRIPTION',
  'OTHER',
]);
export const BillingTransactionStatusSchema = z.enum([
  'PENDING',
  'PAID',
  'CANCELLED',
  'REFUNDED',
]);

export const UpdateBillingTransactionSchema = z.object({
  amount: z.number().min(0).optional(),
  type: BillingTransactionTypeSchema.optional(),
  status: BillingTransactionStatusSchema.optional(),
  description: z.string().max(2000).nullable().optional(),
  date: z.string().datetime().optional(),
  patientId: z.string().uuid().nullable().optional(),
  consultationId: z.string().uuid().nullable().optional(),
  surgeryId: z.string().uuid().nullable().optional(),
});
export type UpdateBillingTransactionInput = z.infer<typeof UpdateBillingTransactionSchema>;

/** GET /v1/billing/usage response */
export const UsageResponseSchema = z.object({
  aiReportsGenerated: z.number().int().min(0),
  planLimit: z.number().int().nullable(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  plan: PlanTypeSchema,
});
export type UsageResponse = z.infer<typeof UsageResponseSchema>;

/** Checkout / portal URL response wrapper */
export const CheckoutResponseSchema = z.object({
  url: z.string().url(),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;

export const PortalResponseSchema = z.object({
  url: z.string().url(),
});
export type PortalResponse = z.infer<typeof PortalResponseSchema>;

/**
 * Webhook payload is the raw Stripe event body — left as an opaque record
 * since signature verification happens against the raw buffer, not parsed JSON.
 * Provided for documentation/typing only.
 */
export const StripeWebhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.unknown(),
});
export type StripeWebhookEvent = z.infer<typeof StripeWebhookEventSchema>;