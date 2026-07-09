// apps/api/src/domain/billing/errors/stripe-signature-invalid.error.ts
/**
 * Thrown when a Stripe webhook signature cannot be verified against the
 * configured webhook secret. Maps to HTTP 400.
 */
export class StripeSignatureInvalidError extends Error {
  constructor(message = 'Invalid Stripe webhook signature') {
    super(message);
    this.name = 'StripeSignatureInvalidError';
  }
}