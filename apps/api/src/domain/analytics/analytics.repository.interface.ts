// apps/api/src/domain/analytics/analytics.repository.interface.ts

export interface DiagnosisDistributionItem {
  code: string;
  description: string;
  count: number;
  percentage: number;
}

export interface AnalyticsOverview {
  totalPatients: number;
  newPatients: number;
  totalConsultations: number;
  totalSurgeries: number;
  avgConsultationsPerPatient: number;
  reportsGenerated: number;
  aiReportsGenerated: number;
  period: { from: string; to: string };
}

export interface ScaleEvolutionData {
  scaleType: string;
  sampleSize: number;
  avgScore: number;
  medianScore: number;
  distribution: Record<string, number>;
  trend: Array<{ month: string; avgScore: number; sampleSize: number }>;
  warning: string | null;
}

export interface AnalyticsFilters {
  organizationId: string;
  from?: Date;
  to?: Date;
}

export interface IAnalyticsRepository {
  getOverview(filters: AnalyticsFilters): Promise<AnalyticsOverview>;
  getDiagnosisDistribution(
    filters: AnalyticsFilters & { system?: 'ICD10' | 'SNOMED'; limit?: number }
  ): Promise<DiagnosisDistributionItem[]>;
  getScaleEvolution(
    filters: AnalyticsFilters & { scaleType: string; diagnosisCode?: string }
  ): Promise<ScaleEvolutionData>;
}
