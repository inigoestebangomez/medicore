// apps/api/src/domain/billing/stripe-event.repository.interface.ts
/**
 * Repository contract for Stripe webhook event idempotency.
 *
 * `tryInsert` must be atomic: the Stripe event id is the primary key, so a
 * duplicate insert fails on the PK constraint and is reported as "already
 * processed".
 */

export interface IProcessedStripeEventRepository {
  /**
   * Persist a processed Stripe event keyed by its event id.
   *
   * @returns `true` when the event was inserted (first time seen),
   *          `false` when an event with the same id already exists (duplicate).
   */
  tryInsert(eventId: string, eventType: string): Promise<boolean>;
}