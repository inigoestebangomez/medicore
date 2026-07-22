// apps/api/src/domain/billing/errors/ai-limit-exceeded.error.ts
/**
 * Thrown when an organization has reached its monthly AI report generation
 * limit (BR-REP-009). Maps to HTTP 429 with code `AI_USAGE_LIMIT_REACHED`.
 */
export class AiLimitExceededError extends Error {
  readonly plan: string;
  readonly limit: number | null;
  readonly yearMonth: string;

  constructor(plan: string, limit: number | null, yearMonth: string) {
    super(
      `AI report generation limit reached for plan ${plan} (limit: ${limit ?? 'unlimited'}) in ${yearMonth}`,
    );
    this.name = 'AiLimitExceededError';
    this.plan = plan;
    this.limit = limit;
    this.yearMonth = yearMonth;
  }
}