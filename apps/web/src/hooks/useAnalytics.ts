// apps/web/src/hooks/useAnalytics.ts
// React Query hooks for the analytics dashboard

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-fetch';

const API_BASE = '/v1';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface OverviewResponse {
  data: {
    totalPatients: number;
    newPatients: number;
    totalConsultations: number;
    totalSurgeries: number;
    avgConsultationsPerPatient: number;
    reportsGenerated: number;
    aiReportsGenerated: number;
    period: { from: string; to: string };
  };
}

export interface DiagnosesResponse {
  data: Array<{
    code: string;
    description: string;
    count: number;
    percentage: number;
  }>;
}

export interface ScaleEvolutionResponse {
  data: {
    scaleType: string;
    sampleSize: number;
    avgScore: number;
    medianScore: number;
    distribution: Record<string, number>;
    trend: Array<{ month: string; avgScore: number; sampleSize: number }>;
    warning: string | null;
  };
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

export interface DashboardStatsResponse {
  data: DashboardStats;
}

// ─────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────

export function useAnalyticsOverview(from?: string, to?: string) {
  return useQuery({
    queryKey: ['analytics', 'overview', from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return apiFetch<OverviewResponse>(
        `${API_BASE}/analytics/overview?${params.toString()}`,
      );
    },
  });
}

export function useDiagnosisDistribution(
  from?: string,
  to?: string,
  system: 'ICD10' | 'SNOMED' = 'ICD10',
  limit = 10,
) {
  return useQuery({
    queryKey: ['analytics', 'diagnoses', from, to, system, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      params.set('system', system);
      params.set('limit', String(limit));
      return apiFetch<DiagnosesResponse>(
        `${API_BASE}/analytics/diagnoses?${params.toString()}`,
      );
    },
  });
}

export function useScaleEvolution(scaleType: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ['analytics', 'scales', scaleType, from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return apiFetch<ScaleEvolutionResponse>(
        `${API_BASE}/analytics/scales/${scaleType}?${params.toString()}`,
      );
    },
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: async () => {
      const res = await apiFetch<DashboardStatsResponse>(`${API_BASE}/analytics/dashboard`);
      return res.data;
    },
  });
}
