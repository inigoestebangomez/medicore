import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  SurgeryResponse,
  CreateSurgeryInput,
  UpdateSurgeryInput,
  ChangeSurgeryStatusInput,
  SurgeryStatus,
} from '@medicore/contracts';
import { apiFetch } from '@/lib/api-fetch';

interface SurgeryListItem {
  id: string;
  patientId: string;
  date: string;
  status: SurgeryStatus;
  procedureType: string;
  physicianId: string;
  asa: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const API_BASE = '/v1/patients';

interface ListResponse {
  items: SurgeryListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const surgeryKeys = {
  all: (patientId: string) => ['surgeries', patientId] as const,
  lists: (patientId: string) => [...surgeryKeys.all(patientId), 'list'] as const,
  detail: (patientId: string, surgeryId: string) =>
    [...surgeryKeys.all(patientId), 'detail', surgeryId] as const,
};

export function useSurgeries(
  patientId: string,
  params?: { page?: number; pageSize?: number; status?: string; sortBy?: string; sortOrder?: string },
) {
  const queryParams = new URLSearchParams();
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));
  if (params?.status) queryParams.set('status', params.status);
  if (params?.sortBy) queryParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) queryParams.set('sortOrder', params.sortOrder);

  return useQuery<ListResponse>({
    queryKey: surgeryKeys.lists(patientId),
    queryFn: async () => {
      const res = await apiFetch<{ data: ListResponse }>(
        `${API_BASE}/${patientId}/surgeries?${queryParams.toString()}`,
      );
      return res.data;
    },
    enabled: !!patientId,
  });
}

export function useSurgery(patientId: string, surgeryId: string) {
  return useQuery<SurgeryResponse>({
    queryKey: surgeryKeys.detail(patientId, surgeryId),
    queryFn: async () => {
      const res = await apiFetch<{ data: SurgeryResponse }>(
        `${API_BASE}/${patientId}/surgeries/${surgeryId}`,
      );
      return res.data;
    },
    enabled: !!patientId && !!surgeryId,
  });
}

export function useCreateSurgery(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<SurgeryResponse, Error, CreateSurgeryInput>({
    mutationFn: async (data) => {
      const res = await apiFetch<{ data: SurgeryResponse }>(
        `${API_BASE}/${patientId}/surgeries`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: surgeryKeys.lists(patientId) });
    },
  });
}

export function useUpdateSurgery(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<SurgeryResponse, Error, { id: string; data: UpdateSurgeryInput }>({
    mutationFn: async ({ id, data }) => {
      const res = await apiFetch<{ data: SurgeryResponse }>(
        `${API_BASE}/${patientId}/surgeries/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        },
      );
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: surgeryKeys.detail(patientId, variables.id) });
      queryClient.invalidateQueries({ queryKey: surgeryKeys.lists(patientId) });
    },
  });
}

export function useDeleteSurgery(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (surgeryId) =>
      fetch(`${API_BASE}/${patientId}/surgeries/${surgeryId}`, { method: 'DELETE' }).then((res) => {
        if (!res.ok && res.status !== 204) {
          throw new Error(`Delete failed: ${res.status}`);
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: surgeryKeys.lists(patientId) });
    },
  });
}

export function useChangeSurgeryStatus(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<SurgeryResponse, Error, { surgeryId: string; input: ChangeSurgeryStatusInput }>({
    mutationFn: async ({ surgeryId, input }) => {
      const res = await apiFetch<{ data: SurgeryResponse }>(
        `${API_BASE}/${patientId}/surgeries/${surgeryId}/change-status`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: surgeryKeys.detail(patientId, variables.surgeryId) });
      queryClient.invalidateQueries({ queryKey: surgeryKeys.lists(patientId) });
    },
  });
}
