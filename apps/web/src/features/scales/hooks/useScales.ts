// apps/web/src/features/scales/hooks/useScales.ts
// React Query hooks for Clinical Scales CRUD operations

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ClinicalScaleType } from '@medicore/contracts';
import { apiFetch } from '@/lib/api-fetch';

const API_BASE = '/v1/patients';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ClinicalScaleResponse {
  id: string;
  patientId: string;
  organizationId: string;
  consultationId: string | null;
  scaleType: ClinicalScaleType;
  date: string;
  scores: Record<string, number>;
  total: number;
  notes: string | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  items: ClinicalScaleResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateScaleInput {
  scaleType: ClinicalScaleType;
  date?: string;
  scores: Record<string, number>;
  notes?: string;
  consultationId?: string;
}

export interface UpdateScaleInput {
  scores?: Record<string, number>;
  notes?: string | null;
}

// ─────────────────────────────────────────────
// Query Keys
// ─────────────────────────────────────────────

const scaleKeys = {
  all: (patientId: string) => ['scales', patientId] as const,
  lists: (patientId: string) => [...scaleKeys.all(patientId), 'list'] as const,
  list: (patientId: string, params?: { scaleType?: ClinicalScaleType; from?: string; to?: string; page?: number; pageSize?: number }) =>
    [...scaleKeys.lists(patientId), params] as const,
  detail: (patientId: string, scaleId: string) =>
    [...scaleKeys.all(patientId), 'detail', scaleId] as const,
};

// ─────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────

/** List clinical scales for a patient with optional filters */
export function useScales(
  patientId: string,
  params?: { scaleType?: ClinicalScaleType; from?: string; to?: string; page?: number; pageSize?: number },
) {
  const queryParams = new URLSearchParams();
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));
  if (params?.scaleType) queryParams.set('scaleType', params.scaleType);
  if (params?.from) queryParams.set('from', params.from);
  if (params?.to) queryParams.set('to', params.to);

  return useQuery<ListResponse>({
    queryKey: scaleKeys.list(patientId, { ...params, page, pageSize }),
    queryFn: () => apiFetch<ListResponse>(`${API_BASE}/${patientId}/scales?${queryParams.toString()}`),
    enabled: !!patientId,
  });
}

/** Get a single clinical scale */
export function useScale(patientId: string, scaleId: string) {
  return useQuery<ClinicalScaleResponse>({
    queryKey: scaleKeys.detail(patientId, scaleId),
    queryFn: () => apiFetch<ClinicalScaleResponse>(`${API_BASE}/${patientId}/scales/${scaleId}`),
    enabled: !!patientId && !!scaleId,
  });
}

/** Create a new clinical scale */
export function useCreateScale(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<ClinicalScaleResponse, Error, CreateScaleInput>({
    mutationFn: (data) =>
      apiFetch<ClinicalScaleResponse>(`${API_BASE}/${patientId}/scales`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scaleKeys.lists(patientId) });
    },
  });
}

/** Update a clinical scale */
export function useUpdateScale(patientId: string, scaleId: string) {
  const queryClient = useQueryClient();
  return useMutation<ClinicalScaleResponse, Error, UpdateScaleInput>({
    mutationFn: (data) =>
      apiFetch<ClinicalScaleResponse>(`${API_BASE}/${patientId}/scales/${scaleId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scaleKeys.detail(patientId, scaleId) });
      queryClient.invalidateQueries({ queryKey: scaleKeys.lists(patientId) });
    },
  });
}

/** Soft delete a clinical scale */
export function useDeleteScale(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (scaleId) =>
      fetch(`${API_BASE}/${patientId}/scales/${scaleId}`, { method: 'DELETE' }).then((res) => {
        if (!res.ok && res.status !== 204) {
          throw new Error(`Delete failed: ${res.status}`);
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scaleKeys.lists(patientId) });
    },
  });
}