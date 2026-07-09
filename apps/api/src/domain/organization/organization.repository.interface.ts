// apps/api/src/domain/organization/organization.repository.interface.ts
import { Organization } from './organization.entity';
import { PlanType, SubscriptionStatus, BillingInterval } from './organization.types';

export interface UpdateSubscriptionData {
  plan?: PlanType;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionExpiresAt?: Date | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  billingInterval?: BillingInterval | null;
}

export interface IOrganizationRepository {
  findById(id: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  create(data: {
    name: string;
    slug: string;
    type?: string;
    logoUrl?: string | null;
  }): Promise<Organization>;
  update(id: string, data: { name?: string; settings?: Record<string, unknown>; logoUrl?: string | null }): Promise<Organization>;
  /**
   * Apply subscription state changes raised by Stripe webhook events.
   * Only the supplied fields are written; undefined fields are left untouched.
   */
  updateSubscription(id: string, data: UpdateSubscriptionData): Promise<Organization>;
  softDelete(id: string): Promise<Organization>;
}