import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ConsultationResponse,
  ConsultationListItem,
  CreateConsultationInput,
  UpdateConsultationInput,
} from '@medicore/contracts';
import { apiFetch } from '@/lib/api-fetch';

const API_BASE = '/v1/patients';

interface ListResponse {
  items: ConsultationListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const consultationKeys = {
  all: (patientId: string) => ['consultations', patientId] as const,
  lists: (patientId: string) => [...consultationKeys.all(patientId), 'list'] as const,
  detail: (patientId: string, consultationId: string) =>
    [...consultationKeys.all(patientId), 'detail', consultationId] as const,
};

export function useConsultations(
  patientId: string,
  params?: { page?: number; pageSize?: number; type?: string; sortBy?: string; sortOrder?: string },
) {
  const queryParams = new URLSearchParams();
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));
  if (params?.type) queryParams.set('type', params.type);
  if (params?.sortBy) queryParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) queryParams.set('sortOrder', params.sortOrder);

  return useQuery<ListResponse>({
    queryKey: consultationKeys.lists(patientId),
    queryFn: async () => {
      const res = await apiFetch<{ data: ListResponse }>(
        `${API_BASE}/${patientId}/consultations?${queryParams.toString()}`,
      );
      return res.data;
    },
    enabled: !!patientId,
  });
}

export function useConsultation(patientId: string, consultationId: string) {
  return useQuery<ConsultationResponse>({
    queryKey: consultationKeys.detail(patientId, consultationId),
    queryFn: async () => {
      const res = await apiFetch<{ data: ConsultationResponse }>(
        `${API_BASE}/${patientId}/consultations/${consultationId}`,
      );
      return res.data;
    },
    enabled: !!patientId && !!consultationId,
  });
}

export function useCreateConsultation(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<ConsultationResponse, Error, CreateConsultationInput>({
    mutationFn: async (data) => {
      const res = await apiFetch<{ data: ConsultationResponse }>(
        `${API_BASE}/${patientId}/consultations`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.lists(patientId) });
    },
  });
}

export function useUpdateConsultation(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<ConsultationResponse, Error, { id: string; data: UpdateConsultationInput }>({
    mutationFn: async ({ id, data }) => {
      const res = await apiFetch<{ data: ConsultationResponse }>(
        `${API_BASE}/${patientId}/consultations/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        },
      );
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.detail(patientId, variables.id) });
      queryClient.invalidateQueries({ queryKey: consultationKeys.lists(patientId) });
    },
  });
}

export function useDeleteConsultation(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (consultationId) =>
      fetch(`${API_BASE}/${patientId}/consultations/${consultationId}`, { method: 'DELETE' }).then((res) => {
        if (!res.ok && res.status !== 204) {
          throw new Error(`Delete failed: ${res.status}`);
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.lists(patientId) });
    },
  });
}
