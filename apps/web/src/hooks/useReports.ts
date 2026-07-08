import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-fetch';

export type ReportType =
  | 'DISCHARGE_SUMMARY'
  | 'SURGICAL_REPORT'
  | 'REFERRAL_LETTER'
  | 'MEDICAL_CERTIFICATE'
  | 'FOLLOW_UP_REPORT'
  | 'PATHOLOGY_REPORT';

export type ReportStatus = 'DRAFT' | 'REVIEWED' | 'SIGNED';

export interface ReportResponse {
  id: string;
  type: ReportType;
  status: ReportStatus;
  title: string;
  content: string;
  sourceType: string | null;
  sourceId: string | null;
  diagnosisCodes: unknown[] | null;
  procedureCodes: unknown[] | null;
  aiGenerated: boolean;
  aiModel: string | null;
  aiPromptHash: string | null;
  pdfUrl: string | null;
  pdfGeneratedAt: string | null;
  signedAt: string | null;
  signedBy: string | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateReportInput {
  sourceType: 'consultation' | 'surgery';
  sourceId: string;
  reportType: ReportType;
  title?: string;
}

export interface GenerateReportResponse {
  reportId: string;
  status: ReportStatus;
  message: string;
}

export interface CreateReportInput {
  title: string;
  content: string;
  type: ReportType;
}

export interface UpdateReportInput {
  title?: string;
  content?: string;
  status?: ReportStatus;
}

export interface SignReportResponse {
  reportId: string;
  status: ReportStatus;
  signedAt: string;
  signedBy: string;
  message: string;
}

const API_BASE = '/v1/patients';

const reportKeys = {
  all: (patientId: string) => ['reports', patientId] as const,
  lists: (patientId: string) => [...reportKeys.all(patientId), 'list'] as const,
  detail: (patientId: string, reportId: string) =>
    [...reportKeys.all(patientId), 'detail', reportId] as const,
};

export function useReports(patientId: string) {
  return useQuery<ReportResponse[]>({
    queryKey: reportKeys.lists(patientId),
    queryFn: async () => {
      const res = await apiFetch<{ data: ReportResponse[] }>(
        `${API_BASE}/${patientId}/reports`,
      );
      return res.data;
    },
    enabled: !!patientId,
  });
}

export function useReport(patientId: string, reportId: string) {
  return useQuery<ReportResponse>({
    queryKey: reportKeys.detail(patientId, reportId),
    queryFn: async () => {
      const res = await apiFetch<{ data: ReportResponse }>(
        `${API_BASE}/${patientId}/reports/${reportId}`,
      );
      return res.data;
    },
    enabled: !!patientId && !!reportId,
  });
}

export function useGenerateReport(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<GenerateReportResponse, Error, GenerateReportInput>({
    mutationFn: async (data) => {
      const res = await apiFetch<{ data: GenerateReportResponse }>(
        `${API_BASE}/${patientId}/reports/generate`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportKeys.lists(patientId) });
    },
  });
}

export function useCreateReport(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<ReportResponse, Error, CreateReportInput>({
    mutationFn: async (data) => {
      const res = await apiFetch<{ data: ReportResponse }>(
        `${API_BASE}/${patientId}/reports`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportKeys.lists(patientId) });
    },
  });
}

export function useUpdateReport(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<ReportResponse, Error, { id: string; data: UpdateReportInput }>({
    mutationFn: async ({ id, data }) => {
      const res = await apiFetch<{ data: ReportResponse }>(
        `${API_BASE}/${patientId}/reports/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        },
      );
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: reportKeys.detail(patientId, variables.id) });
      queryClient.invalidateQueries({ queryKey: reportKeys.lists(patientId) });
    },
  });
}

export function useSignReport(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<SignReportResponse, Error, string>({
    mutationFn: async (reportId) => {
      const res = await apiFetch<{ data: SignReportResponse }>(
        `${API_BASE}/${patientId}/reports/${reportId}/sign`,
        {
          method: 'POST',
          body: JSON.stringify({ confirmDisclaimer: true }),
        },
      );
      return res.data;
    },
    onSuccess: (_, reportId) => {
      queryClient.invalidateQueries({ queryKey: reportKeys.detail(patientId, reportId) });
      queryClient.invalidateQueries({ queryKey: reportKeys.lists(patientId) });
    },
  });
}
