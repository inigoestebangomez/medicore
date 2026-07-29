// apps/web/src/hooks/useResearchV2.ts
// React Query hooks for the Research Engine V2 endpoints (spec §1-§9).
// Mirrors the useResearch.ts convention: every response follows the
// `{ data: ... }` envelope (unwrapped by apiFetch typing) and keys live under
// the shared `research` namespace so invalidation cascades across v1 + v2.
//
// Base path matches the API global prefix: /v1/research/*.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-fetch';
import type {
  Filter,
  FilterLogic,
  DataSource,
  FieldCatalogEntry,
  FieldType,
  DashboardWidget,
  DashboardLayout,
  DashboardResponse,
  WidgetPosition,
  CrossTabResult,
  TimeSeriesResult,
  TimeSeriesPeriod,
  StatisticalTestResult,
  SurvivalResult,
  InferentialRequest,
  ExportV2Request,
  ExportV2Response,
  SharePermission,
} from '@medicore/contracts';

const API_BASE = '/v1/research';

// ─────────────────────────────────────────────
// Shared response shapes (mirror API DTOs)
// ─────────────────────────────────────────────

export interface AdHocResultRow {
  patientId: string;
  nhc: string;
  fields: Record<string, unknown>;
}
export interface AdHocFieldStat {
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
export interface AdHocCategoryDist {
  field: string;
  categories: Array<{ label: string; count: number }>;
}
export interface AdHocResult {
  totalRows: number;
  rows: AdHocResultRow[];
  stats: AdHocFieldStat[];
  distributions: AdHocCategoryDist[];
  displayFields: string[];
  appliedFilters: Filter[];
  warnings?: string[];
}
export interface PaginatedResult {
  items: AdHocResultRow[];
  totalRows: number;
  nextCursor: string | null;
}
export interface DashboardListResult {
  items: DashboardResponse[];
  total: number;
  page: number;
  pageSize: number;
}
export interface SharedQueryItem {
  id: string;
  name: string;
  description: string | null;
  dataSource: string;
  ownerName: string | null;
  permission: SharePermission;
  lastRunAt: string | null;
  lastRunCount: number | null;
  updatedAt: string;
}

// ─────────────────────────────────────────────
// Query keys
// ─────────────────────────────────────────────

export const researchV2Keys = {
  fields: (q: string, type?: string) => ['research', 'fields', q, type ?? null] as const,
  adhoc: (key: string) => ['research', 'adhoc', key] as const,
  results: (id: string, cursor?: string) => ['research', 'results', id, cursor ?? null] as const,
  dashboards: (page: number) => ['research', 'dashboards', page] as const,
  dashboard: (id: string) => ['research', 'dashboard', id] as const,
  crossTab: (row: string, col: string, queryId?: string) =>
    ['research', 'crossTab', row, col, queryId ?? null] as const,
  timeSeries: (metric: string, period: TimeSeriesPeriod, queryId?: string) =>
    ['research', 'timeSeries', metric, period, queryId ?? null] as const,
  shared: (page: number) => ['research', 'shared', page] as const,
  exportJob: (jobId: string) => ['research', 'exportJob', jobId] as const,
};

// ─────────────────────────────────────────────
// Field discovery (spec §5)
// ─────────────────────────────────────────────

export function useFieldCatalog(query: string, type?: FieldType, enabled = true) {
  return useQuery({
    queryKey: researchV2Keys.fields(query, type),
    queryFn: async (): Promise<{ query: string; type: FieldType | undefined; entries: FieldCatalogEntry[] }> => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (type) params.set('type', type);
      const res = await apiFetch<{ data: { query: string; type: FieldType | undefined; entries: FieldCatalogEntry[] } }>(
        `${API_BASE}/fields?${params.toString()}`,
      );
      return res.data;
    },
    enabled: enabled && query.length >= 0,
    staleTime: 60_000, // catalog is cached server-side (Redis TTL 1h)
  });
}

// ─────────────────────────────────────────────
// Ad-hoc execution + cursor pagination (spec §8)
// ─────────────────────────────────────────────

export interface ExecuteAdHocInput {
  filters: Filter[];
  filterLogic: FilterLogic;
  dataSource?: DataSource;
  importBatchIds?: string[];
  displayFields?: string[];
  statsMode?: 'descriptive' | 'inferential';
  cursor?: string;
  limit?: number;
}

export function useExecuteAdHoc() {
  return useMutation({
    mutationFn: async (input: ExecuteAdHocInput): Promise<AdHocResult> => {
      const res = await apiFetch<{ data: AdHocResult }>(`${API_BASE}/queries/execute`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return res.data;
    },
  });
}

export function usePaginatedResults(queryId: string | null, cursor?: string, limit = 50) {
  return useQuery({
    queryKey: researchV2Keys.results(queryId ?? 'none', cursor),
    queryFn: async (): Promise<PaginatedResult> => {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      params.set('limit', String(limit));
      const res = await apiFetch<{ data: PaginatedResult }>(
        `${API_BASE}/queries/${queryId}/results?${params.toString()}`,
      );
      return res.data;
    },
    enabled: !!queryId,
  });
}

// ─────────────────────────────────────────────
// Dashboards (spec §4, design AD-2)
// ─────────────────────────────────────────────

export function useDashboards(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: researchV2Keys.dashboards(page),
    queryFn: async (): Promise<DashboardListResult> => {
      const res = await apiFetch<{ data: DashboardListResult }>(
        `${API_BASE}/dashboards?page=${page}&pageSize=${pageSize}`,
      );
      return res.data;
    },
  });
}

export function useDashboard(id: string | null) {
  return useQuery({
    queryKey: researchV2Keys.dashboard(id ?? 'none'),
    queryFn: async (): Promise<DashboardResponse> => {
      const res = await apiFetch<{ data: DashboardResponse }>(`${API_BASE}/dashboards/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      widgets?: DashboardWidget[];
      layout?: DashboardLayout;
    }): Promise<DashboardResponse> => {
      const res = await apiFetch<{ data: DashboardResponse }>(`${API_BASE}/dashboards`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', 'dashboards'] }),
  });
}

export function useUpdateDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      description?: string | null;
      layout?: DashboardLayout;
    }): Promise<DashboardResponse> => {
      const res = await apiFetch<{ data: DashboardResponse }>(`${API_BASE}/dashboards/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: input.name, description: input.description, layout: input.layout }),
      });
      return res.data;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['research', 'dashboards'] });
      qc.invalidateQueries({ queryKey: researchV2Keys.dashboard(d.id) });
    },
  });
}

export function useDeleteDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await apiFetch<{ data: { id: string; deleted: boolean } }>(`${API_BASE}/dashboards/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', 'dashboards'] }),
  });
}

export function useAddWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { dashboardId: string; widget: DashboardWidget }): Promise<DashboardResponse> => {
      const res = await apiFetch<{ data: DashboardResponse }>(
        `${API_BASE}/dashboards/${input.dashboardId}/widgets`,
        { method: 'POST', body: JSON.stringify(input.widget) },
      );
      return res.data;
    },
    onSuccess: (d) => qc.invalidateQueries({ queryKey: researchV2Keys.dashboard(d.id) }),
  });
}

export function useRemoveWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { dashboardId: string; widgetId: string }): Promise<DashboardResponse> => {
      const res = await apiFetch<{ data: DashboardResponse }>(
        `${API_BASE}/dashboards/${input.dashboardId}/widgets/${input.widgetId}`,
        { method: 'DELETE' },
      );
      return res.data;
    },
    onSuccess: (d) => qc.invalidateQueries({ queryKey: researchV2Keys.dashboard(d.id) }),
  });
}

export function useUpdateLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      dashboardId: string;
      positions: Record<string, WidgetPosition>;
    }): Promise<DashboardResponse> => {
      const res = await apiFetch<{ data: DashboardResponse }>(
        `${API_BASE}/dashboards/${input.dashboardId}/layout`,
        { method: 'PATCH', body: JSON.stringify({ positions: input.positions }) },
      );
      return res.data;
    },
    onSuccess: (d) => qc.invalidateQueries({ queryKey: researchV2Keys.dashboard(d.id) }),
  });
}

// ─────────────────────────────────────────────
// Analytics: cross-tab + time-series + inferential (spec §1-§3)
// ─────────────────────────────────────────────

export function useCrossTab(row: string, col: string, queryId?: string, dataSource?: string, enabled = true) {
  return useQuery({
    queryKey: researchV2Keys.crossTab(row, col, queryId),
    queryFn: async (): Promise<CrossTabResult> => {
      const params = new URLSearchParams({ row, col });
      if (queryId) params.set('queryId', queryId);
      if (dataSource) params.set('dataSource', dataSource);
      const res = await apiFetch<{ data: CrossTabResult }>(`${API_BASE}/cross-tab?${params.toString()}`);
      return res.data;
    },
    enabled: enabled && row.length > 0 && col.length > 0,
  });
}

export function useTimeSeries(
  metric: string,
  period: TimeSeriesPeriod,
  queryId?: string,
  dateField?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: researchV2Keys.timeSeries(metric, period, queryId),
    queryFn: async (): Promise<TimeSeriesResult> => {
      const params = new URLSearchParams({ metric, period });
      if (queryId) params.set('queryId', queryId);
      if (dateField) params.set('dateField', dateField);
      const res = await apiFetch<{ data: TimeSeriesResult }>(`${API_BASE}/time-series?${params.toString()}`);
      return res.data;
    },
    enabled: enabled && metric.length > 0,
  });
}

export type InferentialResult = StatisticalTestResult | SurvivalResult;

export function useInferential() {
  return useMutation({
    mutationFn: async (input: InferentialRequest): Promise<InferentialResult> => {
      const res = await apiFetch<{ data: InferentialResult }>(`${API_BASE}/stats/inferential`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return res.data;
    },
  });
}

// ─────────────────────────────────────────────
// Export V2 (spec §6, design AD-4) — async jobId + optional polling
// ─────────────────────────────────────────────

export function useExportV2() {
  return useMutation({
    mutationFn: async (input: ExportV2Request): Promise<ExportV2Response> => {
      const res = await apiFetch<{ data: ExportV2Response }>(`${API_BASE}/export/v2`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return res.data;
    },
  });
}

// ─────────────────────────────────────────────
// Sharing (spec §7, BR-RES-001)
// ─────────────────────────────────────────────

export function useShareQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      queryId: string;
      userIds: string[];
      permission: SharePermission;
    }): Promise<{ users: string[]; permission: SharePermission }> => {
      const res = await apiFetch<{ data: { users: string[]; permission: SharePermission } }>(
        `${API_BASE}/queries/${input.queryId}/share`,
        { method: 'POST', body: JSON.stringify({ userIds: input.userIds, permission: input.permission }) },
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', 'shared'] }),
  });
}

export function useRevokeShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { queryId: string; userId?: string }): Promise<unknown> => {
      const path = input.userId
        ? `${API_BASE}/queries/${input.queryId}/share/${input.userId}`
        : `${API_BASE}/queries/${input.queryId}/share`;
      const res = await apiFetch<{ data: unknown }>(path, { method: 'DELETE' });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', 'shared'] }),
  });
}

export function useSharedQueries(page = 1) {
  return useQuery({
    queryKey: researchV2Keys.shared(page),
    queryFn: async (): Promise<{ items: SharedQueryItem[]; total: number }> => {
      const res = await apiFetch<{ data: { items: SharedQueryItem[]; total: number } }>(
        `${API_BASE}/shared?page=${page}`,
      );
      return res.data;
    },
  });
}
