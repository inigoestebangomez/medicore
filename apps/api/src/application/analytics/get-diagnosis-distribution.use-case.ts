import type { IAnalyticsRepository, AnalyticsFilters, DiagnosisDistributionItem } from '@/domain/analytics/analytics.repository.interface';

export interface GetDiagnosisDistributionQuery {
  organizationId: string;
  from?: string;
  to?: string;
  system?: 'ICD10' | 'SNOMED';
  limit?: number;
}

export class GetDiagnosisDistributionUseCase {
  constructor(private readonly analyticsRepo: IAnalyticsRepository) {}

  async execute(query: GetDiagnosisDistributionQuery): Promise<DiagnosisDistributionItem[]> {
    const filters: AnalyticsFilters & { system?: 'ICD10' | 'SNOMED'; limit?: number } = {
      organizationId: query.organizationId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      system: query.system,
      limit: query.limit,
    };
    return this.analyticsRepo.getDiagnosisDistribution(filters);
  }
}
