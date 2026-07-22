// apps/api/src/application/billing/queries/get-current-usage.use-case.ts
import type { IOrganizationRepository } from '@/domain/organization/organization.repository.interface';
import type { IAiReportUsageRepository } from '@/domain/billing/ai-report-usage.repository.interface';
import { getLimit } from '@/domain/billing/plan.config';
import { getCurrentYearMonth } from '@/domain/billing/year-month';
import { PlanType } from '@/domain/organization/organization.types';

export interface GetCurrentUsageCommand {
  organizationId: string;
}

export interface UsageResult {
  aiReportsGenerated: number;
  planLimit: number | null;
  yearMonth: string;
  plan: PlanType;
}

/**
 * Returns the organization's current-month AI report usage and plan limit.
 * Used by GET /billing/usage for the dashboard.
 */
export class GetCurrentUsageUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly usageRepo: IAiReportUsageRepository,
  ) {}

  async execute(command: GetCurrentUsageCommand): Promise<UsageResult> {
    const org = await this.orgRepo.findById(command.organizationId);
    const plan: PlanType = org?.plan ?? PlanType.FREE;
    const yearMonth = getCurrentYearMonth();

    const state = await this.usageRepo.getCurrent(command.organizationId, yearMonth);

    return {
      aiReportsGenerated: state?.count ?? 0,
      planLimit: getLimit(plan),
      yearMonth,
      plan,
    };
  }
}