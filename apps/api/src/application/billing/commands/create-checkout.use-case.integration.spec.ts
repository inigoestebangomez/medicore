// apps/api/src/application/billing/commands/create-checkout.use-case.integration.spec.ts
// Integration: checkout + portal use cases with mocked StripeService + org repo.
// Covers: SUBSCRIPTION_ALREADY_ACTIVE, customer storage, portal missing customer.

import { CreateCheckoutUseCase } from './create-checkout.use-case';
import { CreatePortalUseCase } from './create-portal.use-case';
import {
  BillingInterval,
  PlanType,
  SubscriptionStatus,
} from '@/domain/organization/organization.types';
import { Organization } from '@/domain/organization/organization.entity';
import type { IOrganizationRepository, UpdateSubscriptionData } from '@/domain/organization/organization.repository.interface';
import { SubscriptionAlreadyActiveError } from '@/domain/billing/errors/subscription-already-active.error';
import { StripeCustomerMissingError } from '@/domain/billing/errors/stripe-customer-missing.error';

function makeOrg(overrides: Partial<ConstructorParameters<typeof Organization>[0]> = {}): Organization {
  return new Organization({
    id: overrides.id ?? 'org-1',
    name: overrides.name ?? 'ACME Clinic',
    slug: overrides.slug ?? 'acme',
    plan: overrides.plan ?? PlanType.FREE,
    subscriptionStatus: overrides.subscriptionStatus ?? SubscriptionStatus.ACTIVE,
    stripeCustomerId: overrides.stripeCustomerId ?? null,
    stripeSubscriptionId: overrides.stripeSubscriptionId ?? null,
    billingInterval: overrides.billingInterval ?? null,
  });
}

class MockOrgRepo implements Partial<IOrganizationRepository> {
  public org: Organization | null = null;
  public updates: { id: string; data: UpdateSubscriptionData }[] = [];

  async findById(id: string): Promise<Organization | null> {
    if (this.org && this.org.id === id) return this.org;
    return null;
  }
  async updateSubscription(id: string, data: UpdateSubscriptionData): Promise<Organization> {
    this.updates.push({ id, data });
    return this.org!;
  }
}

const mockStripe = {
  createCheckoutSession: jest.fn(),
  createPortalSession: jest.fn(),
  constructEvent: jest.fn(),
};

describe('CreateCheckoutUseCase', () => {
  let orgRepo: MockOrgRepo;
  let useCase: CreateCheckoutUseCase;

  beforeEach(() => {
    mockStripe.createCheckoutSession.mockReset();
    orgRepo = new MockOrgRepo();
    useCase = new CreateCheckoutUseCase(orgRepo as any, mockStripe as any);
  });

  it('creates a checkout session for a FREE org and stores the stripe customer', async () => {
    orgRepo.org = makeOrg({ plan: PlanType.FREE });
    mockStripe.createCheckoutSession.mockResolvedValue({
      id: 'cs_1',
      url: 'https://checkout.stripe.com/c/cs_1',
      customer: 'cus_new',
      subscription: null,
    });

    const result = await useCase.execute({
      organizationId: 'org-1',
      billingInterval: BillingInterval.MONTHLY,
      customerEmail: 'doc@example.com',
    });

    expect(result.url).toBe('https://checkout.stripe.com/c/cs_1');
    expect(mockStripe.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        interval: BillingInterval.MONTHLY,
        customerEmail: 'doc@example.com',
      }),
    );
    // New customer stored on the org.
    expect(orgRepo.updates[0].data.stripeCustomerId).toBe('cus_new');
  });

  it('still works when the session has no customer yet (no update)', async () => {
    orgRepo.org = makeOrg({ plan: PlanType.FREE, stripeCustomerId: null });
    mockStripe.createCheckoutSession.mockResolvedValue({
      id: 'cs_2',
      url: 'https://checkout.stripe.com/c/cs_2',
      customer: null,
      subscription: null,
    });

    const result = await useCase.execute({
      organizationId: 'org-1',
      billingInterval: BillingInterval.YEARLY,
      customerEmail: 'x@example.com',
    });

    expect(result.url).toBe('https://checkout.stripe.com/c/cs_2');
    expect(orgRepo.updates).toHaveLength(0);
  });

  it('throws SubscriptionAlreadyActiveError when paid sub is already ACTIVE', async () => {
    orgRepo.org = makeOrg({
      plan: PlanType.PRO,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
    });

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        billingInterval: BillingInterval.MONTHLY,
        customerEmail: 'x@example.com',
      }),
    ).rejects.toBeInstanceOf(SubscriptionAlreadyActiveError);

    expect(mockStripe.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('throws when org is not found', async () => {
    orgRepo.org = null;
    await expect(
      useCase.execute({
        organizationId: 'missing',
        billingInterval: BillingInterval.MONTHLY,
        customerEmail: 'x@example.com',
      }),
    ).rejects.toThrow('Organization not found');
  });
});

describe('CreatePortalUseCase', () => {
  let orgRepo: MockOrgRepo;
  let useCase: CreatePortalUseCase;

  beforeEach(() => {
    mockStripe.createPortalSession.mockReset();
    orgRepo = new MockOrgRepo();
    useCase = new CreatePortalUseCase(orgRepo as any, mockStripe as any);
  });

  it('creates a portal session for an org with a stripe customer', async () => {
    orgRepo.org = makeOrg({ stripeCustomerId: 'cus_x' });
    mockStripe.createPortalSession.mockResolvedValue({ url: 'https://portal.stripe.com/p' });

    const result = await useCase.execute({ organizationId: 'org-1' });

    expect(result.url).toBe('https://portal.stripe.com/p');
    expect(mockStripe.createPortalSession).toHaveBeenCalledWith('cus_x');
  });

  it('throws StripeCustomerMissingError when no stripe customer', async () => {
    orgRepo.org = makeOrg({ stripeCustomerId: null });
    await expect(useCase.execute({ organizationId: 'org-1' })).rejects.toBeInstanceOf(
      StripeCustomerMissingError,
    );
    expect(mockStripe.createPortalSession).not.toHaveBeenCalled();
  });
});