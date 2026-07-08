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