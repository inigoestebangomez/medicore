import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PatientResponse, CreatePatientInput } from '@medicore/contracts';
import { apiFetch } from '@/lib/api-fetch';

const API_BASE = '/v1/patients';

interface PatientListItem {
  id: string;
  nhc: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  sex: string;
  age: number;
  isPediatric: boolean;
  hasCriticalAllergy: boolean;
  hasActiveAllergies: boolean;
  bloodType: string;
  createdAt: string;
  updatedAt: string;
  phone?: string | null;
  email?: string | null;
  idDocument?: string | null;
}

interface ListResponse {
  items: PatientListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const patientKeys = {
  all: ['patients'] as const,
  lists: () => [...patientKeys.all, 'list'] as const,
  search: (query: string) => [...patientKeys.all, 'search', query] as const,
  detail: (id: string) => [...patientKeys.all, 'detail', id] as const,
};

export function usePatients(params?: {
  query?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
}) {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const query = params?.query;

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));
  if (params?.sortBy) queryParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) queryParams.set('sortOrder', params.sortOrder);

  if (query && query.length > 0) {
    queryParams.set('query', query);
    return useQuery<ListResponse>({
      queryKey: patientKeys.search(query),
      queryFn: async () => {
        const res = await apiFetch<{ data: ListResponse } | ListResponse>(
          `${API_BASE}/search?${queryParams.toString()}`,
        );
        return 'data' in res ? (res as { data: ListResponse }).data : (res as ListResponse);
      },
      enabled: query.length >= 1,
    });
  }

  return useQuery<ListResponse>({
    queryKey: patientKeys.lists(),
    queryFn: async () => {
      const res = await apiFetch<{ data: ListResponse } | ListResponse>(
        `${API_BASE}?${queryParams.toString()}`,
      );
      return 'data' in res ? (res as { data: ListResponse }).data : (res as ListResponse);
    },
  });
}

export function usePatient(patientId: string) {
  return useQuery<PatientResponse>({
    queryKey: patientKeys.detail(patientId),
    queryFn: async () => {
      const res = await apiFetch<{ data: PatientResponse } | PatientResponse>(
        `${API_BASE}/${patientId}`,
      );
      return 'data' in res ? (res as { data: PatientResponse }).data : (res as PatientResponse);
    },
    enabled: !!patientId,
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation<PatientResponse, Error, { input: CreatePatientInput; confirmDuplicate?: boolean }>({
    mutationFn: async ({ input, confirmDuplicate }) => {
      const headers: Record<string, string> = {};
      if (confirmDuplicate) {
        headers['x-confirm-duplicate'] = 'true';
      }
      const res = await apiFetch<{ data: PatientResponse } | PatientResponse>(API_BASE, {
        method: 'POST',
        body: JSON.stringify(input),
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });
      return 'data' in res ? (res as { data: PatientResponse }).data : (res as PatientResponse);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: patientKeys.lists() });
    },
  });
}
