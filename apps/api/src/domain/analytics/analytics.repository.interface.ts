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

export interface DashboardStatsChange {
  value: number;
  percent: number;
  period: 'month' | 'week';
}

export interface DashboardStats {
  patients: {
    total: number;
    change: DashboardStatsChange;
    monthly: Array<{ month: string; new: number }>;
  };
  appointments: {
    total: number;
    change: DashboardStatsChange;
    weekly: Array<{ week: string; count: number }>;
    byType: Record<string, number>;
  };
  surgeries: {
    total: number;
    change: DashboardStatsChange;
    monthly: Array<{ month: string; count: number }>;
    byStatus: Record<string, number>;
  };
  treatments: {
    active: number;
    newThisMonth: number;
    monthly: Array<{ month: string; new: number }>;
  };
  billing: {
    totalThisMonth: number;
    change: DashboardStatsChange;
    monthly: Array<{ month: string; total: number }>;
    byType: Record<string, number>;
  };
  schedule: {
    todayAppointments: number;
    todaySurgeries: number;
    nextAppointment: { time: string; patientName: string } | null;
  };
}

export interface IAnalyticsRepository {
  getOverview(filters: AnalyticsFilters): Promise<AnalyticsOverview>;
  getDiagnosisDistribution(
    filters: AnalyticsFilters & { system?: 'ICD10' | 'SNOMED'; limit?: number }
  ): Promise<DiagnosisDistributionItem[]>;
  getScaleEvolution(
    filters: AnalyticsFilters & { scaleType: string; diagnosisCode?: string }
  ): Promise<ScaleEvolutionData>;
  getDashboardStats(organizationId: string): Promise<DashboardStats>;
}
