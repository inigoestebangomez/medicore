// apps/api/src/application/billing/commands/create-portal.use-case.ts
import type { IOrganizationRepository } from '@/domain/organization/organization.repository.interface';
import type { StripeService } from '@/infrastructure/billing/stripe.service';
import { StripeCustomerMissingError } from '@/domain/billing/errors/stripe-customer-missing.error';

export interface CreatePortalCommand {
  organizationId: string;
}

export interface PortalResult {
  url: string;
}

/**
 * Creates a Stripe Billing Portal session for an organization that already has
 * a Stripe customer id. Used to let customers manage their subscription,
 * update payment methods, etc.
 */
export class CreatePortalUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly stripe: StripeService,
  ) {}

  async execute(command: CreatePortalCommand): Promise<PortalResult> {
    const org = await this.orgRepo.findById(command.organizationId);
    if (!org) {
      throw new Error(`Organization not found: ${command.organizationId}`);
    }

    if (!org.stripeCustomerId) {
      throw new StripeCustomerMissingError();
    }

    const session = await this.stripe.createPortalSession(org.stripeCustomerId);

    return { url: session.url };
  }
}