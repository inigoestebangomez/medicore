// apps/api/src/domain/organization/organization.entity.ts
import { OrganizationType, PlanType, SubscriptionStatus, BillingInterval } from './organization.types';

export class Organization {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly type: OrganizationType;
  readonly plan: PlanType;
  readonly subscriptionStatus: SubscriptionStatus;
  readonly subscriptionExpiresAt: Date | null;
  readonly stripeCustomerId: string | null;
  readonly stripeSubscriptionId: string | null;
  readonly billingInterval: BillingInterval | null;
  readonly settings: Record<string, unknown>;
  readonly logoUrl: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(props: {
    id: string;
    name: string;
    slug: string;
    type?: OrganizationType;
    plan?: PlanType;
    subscriptionStatus?: SubscriptionStatus;
    subscriptionExpiresAt?: Date | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    billingInterval?: BillingInterval | null;
    settings?: Record<string, unknown>;
    logoUrl?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
    deletedAt?: Date | null;
  }) {
    this.id = props.id;
    this.name = props.name;
    this.slug = props.slug;
    this.type = props.type ?? OrganizationType.SOLO_PRACTICE;
    this.plan = props.plan ?? PlanType.FREE;
    this.subscriptionStatus = props.subscriptionStatus ?? SubscriptionStatus.ACTIVE;
    this.subscriptionExpiresAt = props.subscriptionExpiresAt ?? null;
    this.stripeCustomerId = props.stripeCustomerId ?? null;
    this.stripeSubscriptionId = props.stripeSubscriptionId ?? null;
    this.billingInterval = props.billingInterval ?? null;
    this.settings = props.settings ?? {};
    this.logoUrl = props.logoUrl ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    this.deletedAt = props.deletedAt ?? null;
  }
}