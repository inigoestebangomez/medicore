// apps/api/src/api/shared/guards/ai-usage.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import type { IOrganizationRepository } from '@/domain/organization/organization.repository.interface';
import type { IAiReportUsageRepository } from '@/domain/billing/ai-report-usage.repository.interface';
import { getLimit } from '@/domain/billing/plan.config';
import { getCurrentYearMonth } from '@/domain/billing/year-month';
import { PlanType } from '@/domain/organization/organization.types';
import { AiLimitExceededError } from '@/domain/billing/errors/ai-limit-exceeded.error';
import type { JwtPayload } from '@medicore/contracts';

/**
 * Enforces BR-REP-009: blocks AI report generation when an organization has
 * reached its monthly AI report limit.
 *
 * Flow:
 *   1. Guard is gated by ENABLE_AI_USAGE_GUARD — when false, every request
 *      passes (canary rollout).
 *   2. ENTERPRISE (limit null) → always pass (no counting required).
 *   3. Otherwise → AiReportUsageRepo.tryIncrement(orgId, yearMonth, limit)
 *      atomically bumps the counter only when below the limit. 0 rows →
 *      throw AiLimitExceededError → HTTP 429.
 *
 * The counter is incremented in the guard so a blocked request never counts,
 * and an allowed request is counted even if downstream generation fails (the
 * usage budget is "attempts" to avoid gaming via error storms).
 */
@Injectable()
export class AiUsageGuard implements CanActivate {
  constructor(
    @Inject('IOrganizationRepository') private readonly orgRepo: IOrganizationRepository,
    @Inject('IAiReportUsageRepository') private readonly usageRepo: IAiReportUsageRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.ENABLE_AI_USAGE_GUARD !== 'true') {
      return true; // canary off
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    if (!user?.organizationId) {
      return true; // not an org-scoped request; let auth guards decide
    }

    const org = await this.orgRepo.findById(user.organizationId);
    if (!org) {
      return true; // missing org: defer to other guards
    }

    const limit = getLimit(org.plan ?? PlanType.FREE);
    if (limit === null) {
      return true; // ENTERPRISE — unlimited
    }

    const yearMonth = getCurrentYearMonth();
    const result = await this.usageRepo.tryIncrement(user.organizationId, yearMonth, limit);
    if (result === null) {
      const err = new AiLimitExceededError(org.plan ?? PlanType.FREE, limit, yearMonth);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: 'AI_USAGE_LIMIT_REACHED',
          message: err.message,
          plan: err.plan,
          limit: err.limit,
          yearMonth: err.yearMonth,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}