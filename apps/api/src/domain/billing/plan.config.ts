// apps/api/src/domain/billing/plan.config.ts
// Plan pricing + AI report monthly limits. Source of truth for BR-REP-009:
//   FREE = 20 AI reports/month
//   PRO  = 200 AI reports/month
//   ENTERPRISE = unlimited (null)
//
// Kept in typed config (not DB) per design decision: values rarely change and a
// redeploy is acceptable. Stripe Price ids are read from env so the same config
// works across environments without code changes.

import { PlanType } from '@/domain/organization/organization.types';

export interface PlanConfig {
  plan: PlanType;
  /** Stripe Price ids keyed by billing interval. FREE has none. */
  stripePriceIds: {
    monthly?: string;
    yearly?: string;
  };
  /**
   * Monthly AI report generation limit. `null` means unlimited (ENTERPRISE).
   * Enforced by the AiReportUsageRepo race-safe upsert (BR-REP-009).
   */
  aiReportsPerMonth: number | null;
}

function priceId(envKey: string): string | undefined {
  const v = process.env[envKey];
  return v && v.trim() !== '' ? v.trim() : undefined;
}

export const PLAN_CONFIG: Record<PlanType, PlanConfig> = {
  FREE: {
    plan: PlanType.FREE,
    stripePriceIds: {},
    aiReportsPerMonth: 20,
  },
  PRO: {
    plan: PlanType.PRO,
    stripePriceIds: {
      monthly: priceId('STRIPE_PRO_PRICE_MONTHLY'),
      yearly: priceId('STRIPE_PRO_PRICE_YEARLY'),
    },
    aiReportsPerMonth: 200,
  },
  ENTERPRISE: {
    plan: PlanType.ENTERPRISE,
    stripePriceIds: {},
    aiReportsPerMonth: null,
  },
};

/**
 * Get the monthly AI report limit for a plan.
 * Returns `null` for plans with no limit (unlimited).
 */
export function getLimit(plan: PlanType): number | null {
  return PLAN_CONFIG[plan]?.aiReportsPerMonth ?? null;
}