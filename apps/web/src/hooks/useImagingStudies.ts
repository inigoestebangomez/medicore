// apps/web/src/hooks/useImagingStudies.ts
// React Query hooks for Imaging Studies CRUD operations

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ImagingStudyType,
  ListImagingStudiesQuery,
  ListOrgImagingStudiesQuery,
  OrgImagingStudyListItem,
} from '@medicore/contracts';
import { apiFetch, unwrapApiData } from '@/lib/api-fetch';

const API_BASE = '/v1/patients';
const ORG_API = '/v1/imaging-studies';

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

type ApiEnvelope<T> = { data: T };

export async function uploadImagingFiles(patientId: string, studyId: string, formData: FormData): Promise<UploadResponse> {
  if (!studyId || studyId === 'undefined' || studyId === 'null') {
    throw new Error('No se puede subir archivos sin un estudio válido.');
  }
  const response = await fetch(`${API_BASE}/${patientId}/imaging/${studyId}/files`, {
    credentials: 'include',
    method: 'POST',
    body: formData,
  });
  const body = await response.json().catch(() => ({ message: response.statusText }));
  if (!response.ok) {
    throw new Error(body.message ?? `Error de subida: ${response.status}`);
  }
  return unwrapApiData(body as UploadResponse | ApiEnvelope<UploadResponse>);
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
  org: (params: ListOrgImagingStudiesQuery) => ['imaging', 'org', params] as const,
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
    queryFn: async () => {
      const res = await apiFetch<{ data: ListResponse } | ListResponse>(`${API_BASE}/${patientId}/imaging?${queryParams.toString()}`);
      return 'data' in res ? res.data : res;
    },
    enabled: !!patientId,
  });
}

/** Get a single imaging study */
export function useImagingStudy(patientId: string, studyId: string) {
  return useQuery<ImagingStudyResponse>({
    queryKey: imagingKeys.detail(patientId, studyId),
    queryFn: async () => {
      const res = await apiFetch<{ data: ImagingStudyResponse } | ImagingStudyResponse>(`${API_BASE}/${patientId}/imaging/${studyId}`);
      return 'data' in res ? res.data : res;
    },
    enabled: !!patientId && !!studyId,
  });
}

/** Create a new imaging study */
export function useCreateImagingStudy(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<ImagingStudyResponse, Error, CreateImagingStudyInput>({
    mutationFn: async (data) => {
      const response = await apiFetch<ImagingStudyResponse | ApiEnvelope<ImagingStudyResponse>>(`${API_BASE}/${patientId}/imaging`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return unwrapApiData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.lists(patientId) });
    },
  });
}

/** Update imaging study metadata */
export function useUpdateImagingStudy(patientId: string, studyId: string) {
  const queryClient = useQueryClient();
  return useMutation<ImagingStudyResponse, Error, UpdateImagingStudyInput>({
    mutationFn: async (data) => {
      const response = await apiFetch<ImagingStudyResponse | ApiEnvelope<ImagingStudyResponse>>(`${API_BASE}/${patientId}/imaging/${studyId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return unwrapApiData(response);
    },
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
    mutationFn: (formData) => uploadImagingFiles(patientId, studyId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.detail(patientId, studyId) });
    },
  });
}

/** Get a presigned URL for a file */
export function usePresignedUrl(patientId: string, studyId: string, fileKey: string) {
  return useQuery<PresignedUrlResponse>({
    queryKey: [...imagingKeys.detail(patientId, studyId), 'presigned', fileKey],
    queryFn: async () => {
      const response = await apiFetch<PresignedUrlResponse | ApiEnvelope<PresignedUrlResponse>>(
        `${API_BASE}/${patientId}/imaging/${studyId}/files/${encodeURIComponent(fileKey)}/url`,
      );
      return unwrapApiData(response);
    },
    enabled: !!patientId && !!studyId && !!fileKey && studyId !== 'undefined' && studyId !== 'null',
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

// ─────────────────────────────────────────────
// Org-wide imaging studies (top-level GET /v1/imaging-studies)
// ─────────────────────────────────────────────

interface OrgListResponse {
  items: OrgImagingStudyListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UseOrgImagingStudiesParams {
  page?: number;
  pageSize?: number;
  type?: ImagingStudyType | '';
  from?: string;
  to?: string;
  sortBy?: 'date' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export function useOrgImagingStudies(params?: UseOrgImagingStudiesParams) {
  const queryParams = new URLSearchParams();
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));
  if (params?.type) queryParams.set('type', params.type);
  if (params?.from) queryParams.set('from', params.from);
  if (params?.to) queryParams.set('to', params.to);
  if (params?.sortBy) queryParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) queryParams.set('sortOrder', params.sortOrder);

  const query: ListOrgImagingStudiesQuery = {
    page,
    pageSize,
    type: (params?.type || undefined) as ImagingStudyType | undefined,
    from: params?.from,
    to: params?.to,
    sortBy: params?.sortBy ?? 'date',
    sortOrder: params?.sortOrder ?? 'desc',
  };

  return useQuery<OrgListResponse>({
    queryKey: imagingKeys.org(query),
    queryFn: async () => {
      const res = await apiFetch<{ data: OrgListResponse }>(
        `${ORG_API}?${queryParams.toString()}`,
      );
      return res.data;
    },
  });
}
