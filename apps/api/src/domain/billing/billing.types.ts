// apps/api/src/domain/billing/billing.types.ts
// Billing domain type definitions. Re-exports shared organization enums so the
// billing layer has a single import surface, and mirrors the Prisma
// `BillingInterval` enum (defined once in organization.types to keep the
// Organization entity and domain layer in sync).

import { PlanType, SubscriptionStatus, BillingInterval } from '../organization/organization.types';

export { PlanType, SubscriptionStatus, BillingInterval };