// apps/api/src/infrastructure/billing/stripe.service.ts
import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { BillingInterval, PlanType } from '@/domain/organization/organization.types';
import { PLAN_CONFIG } from '@/domain/billing/plan.config';
import { StripeSignatureInvalidError } from '@/domain/billing/errors/stripe-signature-invalid.error';

const PRO_PRICE_PLAN = PlanType.PRO;

export interface CheckoutSessionOptions {
  customerEmail: string;
  organizationId: string;
  interval: BillingInterval;
}

/**
 * Injectable wrapper around the Stripe SDK. Centralizes Stripe key/secret
 * handling, webhook signature verification, and Price lookup so the rest of
 * the billing module never instantiates the SDK directly.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly client: Stripe;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY ?? '';
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not set — Stripe billing operations will fail');
    }
    this.client = new Stripe(secretKey || 'sk_test_placeholder');
  }

  /** Lowest interval price for annual display (cents/month equivalent ignored here). */
  private resolvePriceId(interval: BillingInterval): string {
    const priceId =
      interval === BillingInterval.MONTHLY
        ? PLAN_CONFIG[PRO_PRICE_PLAN].stripePriceIds.monthly
        : PLAN_CONFIG[PRO_PRICE_PLAN].stripePriceIds.yearly;
    if (!priceId) {
      throw new Error(
        `Stripe Price id not configured for interval ${interval} (set STRIPE_PRO_PRICE_${interval})`,
      );
    }
    return priceId;
  }

  async createCheckoutSession(opts: CheckoutSessionOptions): Promise<Stripe.Checkout.Session> {
    const priceId = this.resolvePriceId(opts.interval);
    const appUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';

    return this.client.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: opts.customerEmail,
      client_reference_id: opts.organizationId,
      metadata: {
        organizationId: opts.organizationId,
        plan: PRO_PRICE_PLAN,
        interval: opts.interval,
      },
      subscription_data: {
        metadata: {
          organizationId: opts.organizationId,
          plan: PRO_PRICE_PLAN,
          interval: opts.interval,
        },
      },
      success_url: `${appUrl}/settings/billing?status=success`,
      cancel_url: `${appUrl}/settings/billing?status=cancelled`,
    });
  }

  async createPortalSession(customerId: string): Promise<Stripe.BillingPortal.Session> {
    const appUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';
    return this.client.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/settings/billing`,
    });
  }

  /**
   * Verify the webhook signature against the configured secret and return the
   * parsed event. Throws StripeSignatureInvalidError on failure.
   */
  constructEvent(rawBody: string | Buffer, signature: string | undefined): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET not set — rejecting webhook');
      throw new StripeSignatureInvalidError('STRIPE_WEBHOOK_SECRET not configured');
    }
    if (!signature) {
      throw new StripeSignatureInvalidError('Missing stripe-signature header');
    }
    try {
      return this.client.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      throw new StripeSignatureInvalidError((err as Error).message);
    }
  }
}

// Re-export the Stripe library type for the webhook use case.
export { Stripe };