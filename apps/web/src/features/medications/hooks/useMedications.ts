// apps/web/src/features/medications/hooks/useMedications.ts
// React Query hooks for Medication Prescriptions CRUD operations

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MedicationStatus } from '@medicore/contracts';
import { apiFetch } from '@/lib/api-fetch';

const API_BASE = '/v1/patients';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface MedicationPrescriptionResponse {
  id: string;
  patientId: string;
  organizationId: string;
  consultationId: string | null;
  physicianId: string;
  drugName: string;
  drugCode: string | null;
  activeIngredient: string | null;
  dosage: string;
  frequency: string;
  route: string | null;
  form: string | null;
  startDate: string;
  endDate: string | null;
  duration: string | null;
  status: MedicationStatus;
  instructions: string | null;
  reason: string | null;
  discontinuationReason: string | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  allergyWarning?: {
    level: 'CRITICAL' | 'SEVERE' | 'MODERATE' | 'MILD';
    substances: string[];
  };
  duplicationWarning?: boolean;
}

interface ListResponse {
  items: MedicationPrescriptionResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreatePrescriptionInput {
  drugName: string;
  drugCode?: string;
  activeIngredient?: string;
  dosage: string;
  frequency: string;
  route?: string;
  form?: string;
  startDate: string;
  endDate?: string | null;
  duration?: string;
  instructions?: string;
  reason?: string;
  consultationId?: string;
}

export interface DiscontinuePrescriptionInput {
  discontinuationReason: string;
}

// ─────────────────────────────────────────────
// Query Keys
// ─────────────────────────────────────────────

const medicationKeys = {
  all: (patientId: string) => ['medications', patientId] as const,
  lists: (patientId: string) => [...medicationKeys.all(patientId), 'list'] as const,
  list: (patientId: string, params?: { status?: MedicationStatus; page?: number; pageSize?: number }) =>
    [...medicationKeys.lists(patientId), params] as const,
  detail: (patientId: string, medicationId: string) =>
    [...medicationKeys.all(patientId), 'detail', medicationId] as const,
};

// ─────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────

/** List medications for a patient with optional status filter */
export function useMedications(
  patientId: string,
  params?: { status?: MedicationStatus; page?: number; pageSize?: number },
) {
  const queryParams = new URLSearchParams();
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));
  if (params?.status) queryParams.set('status', params.status);

  return useQuery<ListResponse>({
    queryKey: medicationKeys.list(patientId, { ...params, page, pageSize }),
    queryFn: () => apiFetch<ListResponse>(`${API_BASE}/${patientId}/medications?${queryParams.toString()}`),
    enabled: !!patientId,
  });
}

/** Get a single medication prescription */
export function useMedication(patientId: string, medicationId: string) {
  return useQuery<MedicationPrescriptionResponse>({
    queryKey: medicationKeys.detail(patientId, medicationId),
    queryFn: () => apiFetch<MedicationPrescriptionResponse>(`${API_BASE}/${patientId}/medications/${medicationId}`),
    enabled: !!patientId && !!medicationId,
  });
}

/** Create a new medication prescription */
export function useCreatePrescription(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<MedicationPrescriptionResponse, Error, CreatePrescriptionInput>({
    mutationFn: (data) =>
      apiFetch<MedicationPrescriptionResponse>(`${API_BASE}/${patientId}/medications`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicationKeys.lists(patientId) });
    },
  });
}

/** Create a prescription with allergy override support */
export function useCreatePrescriptionWithOverride(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<MedicationPrescriptionResponse, Error, { data: CreatePrescriptionInput; overrideAllergy?: boolean }>({
    mutationFn: ({ data, overrideAllergy }) =>
      apiFetch<MedicationPrescriptionResponse>(`${API_BASE}/${patientId}/medications`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: overrideAllergy ? { 'X-Override-Critical-Allergy': 'confirmed' } : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicationKeys.lists(patientId) });
    },
  });
}

/** Discontinue a medication prescription */
export function useDiscontinueMedication(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<MedicationPrescriptionResponse, Error, { medicationId: string; data: DiscontinuePrescriptionInput }>({
    mutationFn: ({ medicationId, data }) =>
      apiFetch<MedicationPrescriptionResponse>(`${API_BASE}/${patientId}/medications/${medicationId}/discontinue`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicationKeys.lists(patientId) });
    },
  });
}

/** Soft delete a medication prescription */
export function useDeleteMedication(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (medicationId) =>
      fetch(`${API_BASE}/${patientId}/medications/${medicationId}`, { method: 'DELETE' }).then((res) => {
        if (!res.ok && res.status !== 204) {
          throw new Error(`Delete failed: ${res.status}`);
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicationKeys.lists(patientId) });
    },
  });
}