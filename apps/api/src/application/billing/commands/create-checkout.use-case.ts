// apps/api/src/application/billing/commands/create-checkout.use-case.ts
import { BillingInterval, PlanType, SubscriptionStatus } from '@/domain/organization/organization.types';
import type { IOrganizationRepository } from '@/domain/organization/organization.repository.interface';
import type { StripeService } from '@/infrastructure/billing/stripe.service';
import { SubscriptionAlreadyActiveError } from '@/domain/billing/errors/subscription-already-active.error';

export interface CreateCheckoutCommand {
  organizationId: string;
  billingInterval: BillingInterval;
  /** Email to prefill in Stripe Checkout. */
  customerEmail: string;
}

export interface CheckoutResult {
  url: string;
  sessionId: string;
  stripeCustomerId: string | null;
}

/**
 * Creates a Stripe Checkout session for upgrading a FREE organization to PRO.
 * Rejects orgs that already have an ACTIVE/TRIALING paid subscription.
 */
export class CreateCheckoutUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly stripe: StripeService,
  ) {}

  async execute(command: CreateCheckoutCommand): Promise<CheckoutResult> {
    const org = await this.orgRepo.findById(command.organizationId);
    if (!org) {
      throw new Error(`Organization not found: ${command.organizationId}`);
    }

    if (
      org.plan !== PlanType.FREE &&
      (org.subscriptionStatus === SubscriptionStatus.ACTIVE ||
        org.subscriptionStatus === SubscriptionStatus.TRIALING)
    ) {
      throw new SubscriptionAlreadyActiveError();
    }

    const session = await this.stripe.createCheckoutSession({
      customerEmail: command.customerEmail,
      organizationId: org.id,
      interval: command.billingInterval,
    });

    // Store the Stripe customer reference up front (it is available on the
    // session even before the subscription is finalized).
    const stripeCustomerId =
      typeof session.customer === 'string' ? session.customer : null;

    if (stripeCustomerId && stripeCustomerId !== org.stripeCustomerId) {
      await this.orgRepo.updateSubscription(org.id, { stripeCustomerId });
    }

    return {
      url: session.url ?? '',
      sessionId: session.id,
      stripeCustomerId,
    };
  }
}