// apps/api/src/domain/organization/organization.types.ts
// Type definitions mirroring Prisma enums

export enum OrganizationType {
  CLINIC = 'CLINIC',
  SOLO_PRACTICE = 'SOLO_PRACTICE',
  HOSPITAL_DEPT = 'HOSPITAL_DEPT',
}

export enum PlanType {
  FREE = 'FREE',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum SubscriptionStatus {
  TRIALING = 'TRIALING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED',
}

/**
 * Billing cycle interval for paid subscriptions.
 * Mirrors the Prisma `BillingInterval` enum. Kept here to avoid a domain
 * dependency on @prisma/client; re-exported from billing.types.ts.
 */
export enum BillingInterval {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}