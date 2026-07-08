// apps/web/src/hooks/useImagingStudies.ts
// React Query hooks for Imaging Studies CRUD operations

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ImagingStudyType,
  ListImagingStudiesQuery,
} from '@medicore/contracts';
import { apiFetch } from '@/lib/api-fetch';

const API_BASE = '/v1/patients';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface ImagingStudyResponse {
  id: string;
  organizationId: string;
  patientId: string;
  surgeryId: string | null;
  consultationId: string | null;
  type: string;
  date: string;
  description: string | null;
  findings: string | null;
  labels: Array<{ label: string; coordinates?: Record<string, unknown> }> | null;
  files: Array<{
    key: string;
    originalName: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
  }>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ListResponse {
  items: ImagingStudyResponse[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface UploadResponse {
  studyId: string;
  filesAdded: number;
  files: Array<{
    key: string;
    originalName: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
  }>;
}

interface PresignedUrlResponse {
  url: string;
  expiresAt: string;
}

interface CreateImagingStudyInput {
  type: ImagingStudyType;
  date: string;
  description?: string;
  surgeryId?: string | null;
  consultationId?: string | null;
}

interface UpdateImagingStudyInput {
  type?: ImagingStudyType;
  date?: string;
  description?: string | null;
  findings?: string | null;
  labels?: Array<{ label: string; coordinates?: Record<string, unknown> }> | null;
  surgeryId?: string | null;
  consultationId?: string | null;
}

// ─────────────────────────────────────────────
// Query Keys
// ─────────────────────────────────────────────

const imagingKeys = {
  all: (patientId: string) => ['imaging', patientId] as const,
  lists: (patientId: string) => [...imagingKeys.all(patientId), 'list'] as const,
  list: (patientId: string, params: ListImagingStudiesQuery) =>
    [...imagingKeys.lists(patientId), params] as const,
  detail: (patientId: string, studyId: string) =>
    [...imagingKeys.all(patientId), 'detail', studyId] as const,
};

// ─────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────

/** List imaging studies for a patient with pagination and filters */
export function useImagingStudies(
  patientId: string,
  params?: Omit<ListImagingStudiesQuery, 'page' | 'pageSize'> & { page?: number; pageSize?: number },
) {
  const queryParams = new URLSearchParams();
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));
  if (params?.type) queryParams.set('type', params.type);
  if (params?.sortBy) queryParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) queryParams.set('sortOrder', params.sortOrder);
  if (params?.from) queryParams.set('from', params.from);
  if (params?.to) queryParams.set('to', params.to);

  return useQuery<ListResponse>({
    queryKey: imagingKeys.list(patientId, { page, pageSize, ...params } as ListImagingStudiesQuery),
    queryFn: () => apiFetch<ListResponse>(`${API_BASE}/${patientId}/imaging?${queryParams.toString()}`),
    enabled: !!patientId,
  });
}

/** Get a single imaging study */
export function useImagingStudy(patientId: string, studyId: string) {
  return useQuery<ImagingStudyResponse>({
    queryKey: imagingKeys.detail(patientId, studyId),
    queryFn: () => apiFetch<ImagingStudyResponse>(`${API_BASE}/${patientId}/imaging/${studyId}`),
    enabled: !!patientId && !!studyId,
  });
}

/** Create a new imaging study */
export function useCreateImagingStudy(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<ImagingStudyResponse, Error, CreateImagingStudyInput>({
    mutationFn: (data) =>
      apiFetch<ImagingStudyResponse>(`${API_BASE}/${patientId}/imaging`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.lists(patientId) });
    },
  });
}

/** Update imaging study metadata */
export function useUpdateImagingStudy(patientId: string, studyId: string) {
  const queryClient = useQueryClient();
  return useMutation<ImagingStudyResponse, Error, UpdateImagingStudyInput>({
    mutationFn: (data) =>
      apiFetch<ImagingStudyResponse>(`${API_BASE}/${patientId}/imaging/${studyId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.detail(patientId, studyId) });
      queryClient.invalidateQueries({ queryKey: imagingKeys.lists(patientId) });
    },
  });
}

/** Upload files to an imaging study */
export function useUploadFiles(patientId: string, studyId: string) {
  const queryClient = useQueryClient();
  return useMutation<UploadResponse, Error, FormData>({
    mutationFn: (formData) =>
      fetch(`${API_BASE}/${patientId}/imaging/${studyId}/files`, {
        method: 'POST',
        body: formData,
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: res.statusText }));
          throw new Error(err.message ?? `Upload failed: ${res.status}`);
        }
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.detail(patientId, studyId) });
    },
  });
}

/** Get a presigned URL for a file */
export function usePresignedUrl(patientId: string, studyId: string, fileKey: string) {
  return useQuery<PresignedUrlResponse>({
    queryKey: [...imagingKeys.detail(patientId, studyId), 'presigned', fileKey],
    queryFn: () =>
      apiFetch<PresignedUrlResponse>(
        `${API_BASE}/${patientId}/imaging/${studyId}/files/${encodeURIComponent(fileKey)}/url`,
      ),
    enabled: !!fileKey,
  });
}

/** Soft delete an imaging study */
export function useDeleteImagingStudy(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (studyId) =>
      fetch(`${API_BASE}/${patientId}/imaging/${studyId}`, { method: 'DELETE' }).then((res) => {
        if (!res.ok && res.status !== 204) {
          throw new Error(`Delete failed: ${res.status}`);
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.lists(patientId) });
    },
  });
}