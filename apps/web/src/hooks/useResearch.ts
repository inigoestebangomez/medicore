// apps/web/src/hooks/useResearch.ts
// React Query hooks for the Clinical Research Engine (Phase 12 frontend).
// All endpoints under /v1/research. Responses follow the { data: ... } envelope
// (unwrapped by the apiFetch typing), matching the useAnalytics convention.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-fetch';
import type {
  Filter,
  FilterLogic,
  DataSource,
  VisualizationType,
  ExportFormat,
} from '@medicore/contracts';

// ─────────────────────────────────────────────
// Response shapes (mirror API DTOs)
// ─────────────────────────────────────────────

export interface QueryHistoryItem {
  id: string;
  name: string;
  description: string | null;
  dataSource: string;
  lastRunAt: string | null;
  lastRunCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface QueryHistoryResponse {
  data: { items: QueryHistoryItem[]; total: number; page: number; pageSize: number };
}

export interface SaveQueryResponse {
  data: { id: string; name: string; createdAt: string; updatedAt: string };
}

export interface ResultRow {
  patientId: string;
  nhc: string;
  fields: Record<string, unknown>;
}

export interface FieldStat {
  field: string;
  n: number;
  mean: number | null;
  median: number | null;
  stdDev: number | null;
  min: number | null;
  max: number | null;
  ci95Lower: number | null;
  ci95Upper: number | null;
}

export interface CategoryDist {
  field: string;
  categories: Array<{ label: string; count: number }>;
}

export interface ExecuteQueryResponse {
  data: {
    queryId: string;
    totalRows: number;
    rows: ResultRow[];
    stats: FieldStat[];
    distributions: CategoryDist[];
    displayFields: string[];
    appliedFilters: Filter[];
  };
}

export interface CollectionListItem {
  id: string;
  name: string;
  description: string | null;
  queryId: string | null;
  isLocked: boolean;
  patientCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionsResponse {
  data: { items: CollectionListItem[]; total: number };
}

export interface CreateCollectionResponse {
  data: { id: string; name: string; queryId: string | null; patientCount: number; isLocked: boolean; createdAt: string };
}

export interface AddMembersResponse {
  data: { collectionId: string; patientCount: number; addedCount: number };
}

export interface LockCollectionResponse {
  data: { collectionId: string; isLocked: boolean; patientCount: number; lockedAt: string };
}

export interface ExportResult {
  format: ExportFormat;
  mimeType: string;
  filename: string;
  content: string;
  manifest?: unknown;
  anonymized: true;
}
export interface ExportResponse {
  data: ExportResult;
}

// ─────────────────────────────────────────────
// Query keys
// ─────────────────────────────────────────────

export const researchKeys = {
  all: ['research'] as const,
  queries: (page: number) => ['research', 'queries', page] as const,
  execute: (id: string) => ['research', 'execute', id] as const,
  collections: (page: number) => ['research', 'collections', page] as const,
};

const API_BASE = '/v1/research';

// ─────────────────────────────────────────────
// Saved queries
// ─────────────────────────────────────────────

export interface SaveQueryInput {
  id?: string;
  name: string;
  description?: string;
  dataSource: DataSource;
  importBatchIds?: string[];
  filters: Filter[];
  filterLogic: FilterLogic;
  displayFields: string[];
  visualizations: VisualizationType[];
}

export function useQueryHistory(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: researchKeys.queries(page),
    queryFn: async (): Promise<QueryHistoryResponse['data']> => {
      const res = await apiFetch<QueryHistoryResponse>(
        `${API_BASE}/queries?page=${page}&pageSize=${pageSize}`,
      );
      return res.data;
    },
  });
}

export function useSaveQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveQueryInput): Promise<SaveQueryResponse['data']> => {
      const res = await apiFetch<SaveQueryResponse>(`${API_BASE}/queries`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: researchKeys.all }),
  });
}

export function useExecuteQuery(queryId: string) {
  return useMutation({
    mutationFn: async (override?: {
      filters?: Filter[];
      filterLogic?: FilterLogic;
      displayFields?: string[];
    }): Promise<ExecuteQueryResponse['data']> => {
      const res = await apiFetch<ExecuteQueryResponse>(
        `${API_BASE}/queries/${queryId}/execute`,
        { method: 'POST', body: JSON.stringify(override ?? {}) },
      );
      return res.data;
    },
  });
}

// Convenience hook that fetches execute results reactively (auto-runs once).
export function useExecuteQueryResult(queryId: string | null) {
  return useQuery({
    queryKey: researchKeys.execute(queryId ?? 'none'),
    queryFn: async (): Promise<ExecuteQueryResponse['data']> => {
      const res = await apiFetch<ExecuteQueryResponse>(
        `${API_BASE}/queries/${queryId}/execute`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      return res.data;
    },
    enabled: !!queryId,
  });
}

export function useDeleteQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (queryId: string): Promise<void> => {
      await apiFetch<{ data: { id: string; deleted: boolean } }>(
        `${API_BASE}/queries/${queryId}`,
        { method: 'DELETE' },
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: researchKeys.all }),
  });
}

// ─────────────────────────────────────────────
// Collections — BR-RES-003 (locked immutable)
// ─────────────────────────────────────────────

export function useCollections(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: researchKeys.collections(page),
    queryFn: async (): Promise<CollectionsResponse['data']> => {
      const res = await apiFetch<CollectionsResponse>(
        `${API_BASE}/collections?page=${page}&pageSize=${pageSize}`,
      );
      return res.data;
    },
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      queryId?: string;
      patientIds?: string[];
    }): Promise<CreateCollectionResponse['data']> => {
      const res = await apiFetch<CreateCollectionResponse>(`${API_BASE}/collections`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', 'collections'] }),
  });
}

export function useAddMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      collectionId: string;
      patientIds: string[];
      notes?: string;
    }): Promise<AddMembersResponse['data']> => {
      const res = await apiFetch<AddMembersResponse>(
        `${API_BASE}/collections/${input.collectionId}/members`,
        { method: 'POST', body: JSON.stringify({ patientIds: input.patientIds, notes: input.notes }) },
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', 'collections'] }),
  });
}

export function useLockCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (collectionId: string): Promise<LockCollectionResponse['data']> => {
      const res = await apiFetch<LockCollectionResponse>(
        `${API_BASE}/collections/${collectionId}/lock`,
        { method: 'POST' },
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', 'collections'] }),
  });
}

// ─────────────────────────────────────────────
// Export — BR-RES-002 (always anonymized)
// ─────────────────────────────────────────────

export function useExport() {
  return useMutation({
    mutationFn: async (input: {
      collectionId?: string;
      queryId?: string;
      format: ExportFormat;
    }): Promise<ExportResult> => {
      const res = await apiFetch<ExportResponse>(`${API_BASE}/export`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return res.data;
    },
  });
}