// apps/api/src/application/billing/commands/handle-stripe-webhook.use-case.ts
import { Logger } from '@nestjs/common';
import type { Stripe } from '@/infrastructure/billing/stripe.service';
import type { IProcessedStripeEventRepository } from '@/domain/billing/stripe-event.repository.interface';
import type { IOrganizationRepository } from '@/domain/organization/organization.repository.interface';
import {
  BillingInterval,
  PlanType,
  SubscriptionStatus,
} from '@/domain/organization/organization.types';

export interface HandleWebhookResult {
  eventType: string;
  eventId: string;
  duplicated: boolean;
}

const STRIPE_PLAN_METADATA = 'plan';
const STRIPE_INTERVAL_METADATA = 'interval';
const ORG_METADATA_KEY = 'organizationId';

function mapStripeStatusToSubscriptionStatus(
  stripeStatus: string,
): SubscriptionStatus {
  switch (stripeStatus) {
    case 'active':
      return SubscriptionStatus.ACTIVE;
    case 'trialing':
      return SubscriptionStatus.TRIALING;
    case 'past_due':
      return SubscriptionStatus.PAST_DUE;
    case 'canceled':
      return SubscriptionStatus.CANCELED;
    case 'expired':
      return SubscriptionStatus.EXPIRED;
    case 'incomplete':
    case 'incomplete_expired':
      return SubscriptionStatus.EXPIRED;
    default:
      return SubscriptionStatus.ACTIVE;
  }
}

function mapStripeInterval(interval: string | undefined): BillingInterval | undefined {
  if (interval === 'month' || interval === BillingInterval.MONTHLY) return BillingInterval.MONTHLY;
  if (interval === 'year' || interval === BillingInterval.YEARLY) return BillingInterval.YEARLY;
  return undefined;
}

function resolvePlanFromMetadata(metadata: Stripe.Metadata | undefined): PlanType {
  const raw = metadata?.[STRIPE_PLAN_METADATA];
  if (raw === PlanType.PRO) return PlanType.PRO;
  if (raw === PlanType.ENTERPRISE) return PlanType.ENTERPRISE;
  if (raw === PlanType.FREE) return PlanType.FREE;
  return PlanType.PRO; // checkout is only ever for PRO in v1
}

/**
 * Idempotent Stripe webhook handler.
 *
 * 1. tryInsert(eventId) — returns false for duplicates (already processed).
 * 2. Switch on event type → translate to organization subscription state.
 *
 * The org id is read from Stripe metadata (`organizationId`) — set on the
 * Checkout session and on the subscription's `subscription_data.metadata`.
 */
export class HandleStripeWebhookUseCase {
  private readonly logger = new Logger(HandleStripeWebhookUseCase.name);

  constructor(
    private readonly eventRepo: IProcessedStripeEventRepository,
    private readonly orgRepo: IOrganizationRepository,
  ) {}

  async execute(event: Stripe.Event): Promise<HandleWebhookResult> {
    const eventId = event.id;
    const eventType = event.type;

    const inserted = await this.eventRepo.tryInsert(eventId, eventType);
    if (!inserted) {
      this.logger.log(`Duplicate Stripe event ignored: ${eventId} (${eventType})`);
      return { eventType, eventId, duplicated: true };
    }

    try {
      switch (eventType) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event);
          break;
        default:
          this.logger.log(`Unhandled Stripe event type: ${eventType}`);
      }
    } catch (error) {
      // Re-thrown asynchronous processing error bubbles up so the controller
      // returns a non-2xx and Stripe retries. The event row stays inserted:
      // a transient failure will NOT be recorded as permanently processed.
      throw error;
    }

    return { eventType, eventId, duplicated: false };
  }

  private async resolveOrgIdFromCheckout(session: Stripe.Checkout.Session): Promise<string | null> {
    const fromRef = typeof session.client_reference_id === 'string' ? session.client_reference_id : null;
    return fromRef ?? (session.metadata?.[ORG_METADATA_KEY] ?? null);
  }

  private async handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;
    const orgId = await this.resolveOrgIdFromCheckout(session);
    if (!orgId) {
      this.logger.warn(`checkout.session.completed without organizationId (${event.id})`);
      return;
    }

    const plan = resolvePlanFromMetadata(session.metadata ?? undefined);
    const interval = mapStripeInterval(session.metadata?.[STRIPE_INTERVAL_METADATA] ?? undefined);

    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : null;
    const customerId =
      typeof session.customer === 'string' ? session.customer : null;

    await this.orgRepo.updateSubscription(orgId, {
      plan,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      ...(interval ? { billingInterval: interval } : {}),
    });

    this.logger.log(`Checkout completed → org ${orgId} upgraded to ${plan} (${interval ?? 'unknown interval'})`);
  }

  private async resolveOrgIdFromSubscription(
    subscription: Stripe.Subscription,
  ): Promise<string | null> {
    const fromMeta = subscription.metadata?.[ORG_METADATA_KEY] ?? null;
    if (fromMeta) return fromMeta;

    // Fallback: look up the org by stripeSubscriptionId is not feasible without
    // a query method; require metadata for subscription events.
    return null;
  }

  private async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const orgId = await this.resolveOrgIdFromSubscription(subscription);
    if (!orgId) {
      this.logger.warn(`customer.subscription.updated without organizationId metadata (${event.id})`);
      return;
    }

    const plan = resolvePlanFromMetadata(subscription.metadata);
    const status = mapStripeStatusToSubscriptionStatus(subscription.status);

    const item = subscription.items?.data?.[0];
    const interval = mapStripeInterval(item?.price?.recurring?.interval);
    // Stripe v22 moved current_period_* from Subscription to SubscriptionItem.
    const expiresAtTimestamp = item?.current_period_end;
    const expiresAt = expiresAtTimestamp
      ? new Date(expiresAtTimestamp * 1000)
      : undefined;

    await this.orgRepo.updateSubscription(orgId, {
      plan,
      subscriptionStatus: status,
      stripeSubscriptionId: subscription.id,
      ...(interval ? { billingInterval: interval } : {}),
      ...(expiresAt ? { subscriptionExpiresAt: expiresAt } : { subscriptionExpiresAt: undefined }),
    });
  }

  private async handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const orgId = await this.resolveOrgIdFromSubscription(subscription);
    if (!orgId) {
      this.logger.warn(`customer.subscription.deleted without organizationId metadata (${event.id})`);
      return;
    }

    await this.orgRepo.updateSubscription(orgId, {
      subscriptionStatus: SubscriptionStatus.CANCELED,
      stripeSubscriptionId: null,
    });
    this.logger.log(`Subscription deleted → org ${orgId} downgraded to CANCELED`);
  }

  private async handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId =
      typeof invoice.customer === 'string' ? invoice.customer : null;
    const orgId = invoice.metadata?.[ORG_METADATA_KEY] ?? null;

    if (!orgId) {
      // Without an org id we cannot update state; log and return. The event is
      // still marked processed to avoid retry storms for unattributable invoices.
      this.logger.warn(
        `invoice.payment_failed without organizationId metadata (${event.id}) customer=${customerId ?? 'n/a'}`,
      );
      return;
    }

    await this.orgRepo.updateSubscription(orgId, {
      subscriptionStatus: SubscriptionStatus.PAST_DUE,
    });
    this.logger.warn(`Payment failed → org ${orgId} set to PAST_DUE`);
  }
}