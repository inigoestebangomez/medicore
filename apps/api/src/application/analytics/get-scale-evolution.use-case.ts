import type { IAnalyticsRepository, AnalyticsFilters, ScaleEvolutionData } from '@/domain/analytics/analytics.repository.interface';

export interface GetScaleEvolutionQuery {
  organizationId: string;
  scaleType: string;
  from?: string;
  to?: string;
  diagnosisCode?: string;
}

export class GetScaleEvolutionUseCase {
  constructor(private readonly analyticsRepo: IAnalyticsRepository) {}

  async execute(query: GetScaleEvolutionQuery): Promise<ScaleEvolutionData> {
    const filters: AnalyticsFilters & { scaleType: string; diagnosisCode?: string } = {
      organizationId: query.organizationId,
      scaleType: query.scaleType,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      diagnosisCode: query.diagnosisCode,
    };
    return this.analyticsRepo.getScaleEvolution(filters);
  }
}
