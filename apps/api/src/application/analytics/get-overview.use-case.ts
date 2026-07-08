import type { IAnalyticsRepository, AnalyticsFilters, AnalyticsOverview } from '@/domain/analytics/analytics.repository.interface';

export interface GetOverviewQuery {
  organizationId: string;
  from?: string;
  to?: string;
}

export class GetOverviewUseCase {
  constructor(private readonly analyticsRepo: IAnalyticsRepository) {}

  async execute(query: GetOverviewQuery): Promise<AnalyticsOverview> {
    const filters: AnalyticsFilters = {
      organizationId: query.organizationId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    };
    return this.analyticsRepo.getOverview(filters);
  }
}
