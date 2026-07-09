// apps/api/src/domain/billing/errors/stripe-customer-missing.error.ts
/**
 * Thrown when a billing portal session is requested for an organization that
 * has no Stripe customer id yet. Maps to HTTP 400 with code
 * `STRIPE_CUSTOMER_MISSING`.
 */
export class StripeCustomerMissingError extends Error {
  constructor(message = 'Missing Stripe customer for organization') {
    super(message);
    this.name = 'StripeCustomerMissingError';
  }
}