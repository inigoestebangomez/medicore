// apps/api/src/domain/billing/errors/subscription-already-active.error.ts
/**
 * Thrown when checkout is requested for an organization that already has an
 * ACTIVE or TRIALING paid subscription. Maps to HTTP 400 with code
 * `SUBSCRIPTION_ALREADY_ACTIVE`.
 */
export class SubscriptionAlreadyActiveError extends Error {
  constructor(message = 'Subscription is already active') {
    super(message);
    this.name = 'SubscriptionAlreadyActiveError';
  }
}