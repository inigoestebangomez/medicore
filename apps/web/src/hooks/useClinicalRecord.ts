// apps/web/src/hooks/useClinicalRecord.ts
// React Query hooks for the seven-category clinical record API.
// Maps to GET/POST/PATCH /v1/patients/:patientId/clinical-record endpoints.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ClinicalRecordCategory,
  ClinicalRecordResponseType,
  HistoryEntryResponse,
  CurrentIllnessResponse,
  PhysicalExamRecordResponse,
  LabReportResponse,
  DiagnosisResponse,
  CreateHistoryEntryInput,
  CreateCurrentIllnessInput,
  CreatePhysicalExamRecordInput,
  ConfirmLabResultsInput,
  CreateDiagnosisInput,
  UpdateDiagnosisStatusInput,
} from '@medicore/contracts';
import { apiFetch } from '@/lib/api-fetch';

const clinicalRecordKeys = {
  all: (patientId: string) => ['clinical-record', patientId] as const,
  category: (patientId: string, category: ClinicalRecordCategory) =>
    [...clinicalRecordKeys.all(patientId), category] as const,
};

// ─────────────────────────────────────────────
// Query hooks
// ─────────────────────────────────────────────

export function useClinicalRecord(
  patientId: string,
  category: ClinicalRecordCategory,
) {
  return useQuery<ClinicalRecordResponseType>({
    queryKey: clinicalRecordKeys.category(patientId, category),
    queryFn: async () => {
      const res = await apiFetch<ClinicalRecordResponseType>(
        `/v1/patients/${patientId}/clinical-record?category=${category}`,
      );
      return res;
    },
    enabled: !!patientId,
  });
}

export function useHistoryEntries(patientId: string) {
  const query = useClinicalRecord(patientId, 'history');
  return {
    ...query,
    entries: (query.data?.data ?? []) as HistoryEntryResponse[],
  };
}

export function useCurrentIllnessEntries(patientId: string) {
  const query = useClinicalRecord(patientId, 'current-illness');
  return {
    ...query,
    entries: (query.data?.data ?? []) as CurrentIllnessResponse[],
  };
}

export function usePhysicalExamRecords(patientId: string) {
  const query = useClinicalRecord(patientId, 'physical-exam');
  return {
    ...query,
    records: (query.data?.data ?? []) as PhysicalExamRecordResponse[],
  };
}

export function useLabReports(patientId: string) {
  const query = useClinicalRecord(patientId, 'complementary-tests');
  return {
    ...query,
    reports: (query.data?.data ?? []) as LabReportResponse[],
  };
}

export function useDiagnoses(patientId: string) {
  const query = useClinicalRecord(patientId, 'diagnosis');
  return {
    ...query,
    diagnoses: (query.data?.data ?? []) as DiagnosisResponse[],
  };
}

// ─────────────────────────────────────────────
// Mutation hooks
// ─────────────────────────────────────────────

export function useCreateHistoryEntry(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<HistoryEntryResponse, Error, CreateHistoryEntryInput>({
    mutationFn: async (input) => {
      return apiFetch<HistoryEntryResponse>(
        `/v1/patients/${patientId}/clinical-record/history`,
        { method: 'POST', body: JSON.stringify(input) },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: clinicalRecordKeys.category(patientId, 'history'),
      });
    },
  });
}

export function useCreateCurrentIllness(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<CurrentIllnessResponse, Error, CreateCurrentIllnessInput>({
    mutationFn: async (input) => {
      return apiFetch<CurrentIllnessResponse>(
        `/v1/patients/${patientId}/clinical-record/current-illness`,
        { method: 'POST', body: JSON.stringify(input) },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: clinicalRecordKeys.category(patientId, 'current-illness'),
      });
    },
  });
}

export function useCreateExamRecord(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<PhysicalExamRecordResponse, Error, CreatePhysicalExamRecordInput>({
    mutationFn: async (input) => {
      return apiFetch<PhysicalExamRecordResponse>(
        `/v1/patients/${patientId}/clinical-record/physical-exam`,
        { method: 'POST', body: JSON.stringify(input) },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: clinicalRecordKeys.category(patientId, 'physical-exam'),
      });
    },
  });
}

export function useConfirmLabResults(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<LabReportResponse, Error, ConfirmLabResultsInput>({
    mutationFn: async (input) => {
      return apiFetch<LabReportResponse>(
        `/v1/patients/${patientId}/clinical-record/lab/confirm`,
        { method: 'POST', body: JSON.stringify(input) },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: clinicalRecordKeys.category(patientId, 'complementary-tests'),
      });
    },
  });
}

export function useCreateDiagnosis(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<DiagnosisResponse, Error, CreateDiagnosisInput>({
    mutationFn: async (input) => {
      return apiFetch<DiagnosisResponse>(
        `/v1/patients/${patientId}/clinical-record/diagnosis`,
        { method: 'POST', body: JSON.stringify(input) },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: clinicalRecordKeys.category(patientId, 'diagnosis'),
      });
    },
  });
}

export function useUpdateDiagnosisStatus(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    DiagnosisResponse,
    Error,
    { diagnosisId: string } & UpdateDiagnosisStatusInput
  >({
    mutationFn: async ({ diagnosisId, ...input }) => {
      return apiFetch<DiagnosisResponse>(
        `/v1/patients/${patientId}/clinical-record/diagnosis/${diagnosisId}/status`,
        { method: 'PATCH', body: JSON.stringify(input) },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: clinicalRecordKeys.category(patientId, 'diagnosis'),
      });
    },
  });
}
