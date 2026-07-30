// apps/web/src/hooks/useStudiesWithBadges.ts
// TanStack Query hooks for the Research Study lifecycle endpoints (M8).
// `useStudiesWithBadges` polls the studies list every 60s and surfaces an
// unread-notification toast when the count increases between polls (useRef for
// the previous count, per the spec — no WebSocket, scalable in V4).
//
// Base path matches the API global prefix: /v1/research/studies.

import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-fetch';

const API_BASE = '/v1/research/studies';

export interface StudyDTO {
  id: string;
  organizationId: string;
  createdBy: string;
  queryId: string;
  name: string;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'FROZEN';
  cachedPatientIds: string[];
  cachedAt: string | null;
  patientCount: number;
  analyses: unknown[];
  publicationRef: string | null;
  frozenAt: string | null;
  createdAt: string;
  updatedAt: string;
  isLive: boolean;
}

export interface StudyListResponse {
  items: StudyDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StudyNotificationsResponse {
  notifications: Array<{
    id: string;
    studyId: string;
    newPatientCount: number;
    readAt: string | null;
    createdAt: string;
  }>;
  unreadCount: number;
}

export interface StudySuggestionDTO {
  id: string;
  type: string;
  rationale: string;
  recommendedEndpoint?: string;
  previewParams?: Record<string, unknown>;
}

export type OnNewPatients = (studyId: string, studyName: string, newCount: number) => void;

/** List studies, polling every 60s; surface a toast when unread notifications grow. */
export function useStudiesWithBadges(
  status?: StudyDTO['status'],
  onNewPatients?: OnNewPatients,
) {
  const prevUnreadRef = useRef<Record<string, number>>({});

  const query = useQuery<StudyListResponse>({
    queryKey: ['research', 'studies', status ?? 'all'],
    queryFn: () => apiFetch<StudyListResponse>(`${API_BASE}?${status ? `status=${status}` : ''}`),
    refetchInterval: 60_000,
  });

  // For each active study, poll unread notifications count for badge + toast.
  const activeStudyIds = (query.data?.items ?? [])
    .filter((s) => s.status === 'ACTIVE')
    .map((s) => s.id);

  const badgesQuery = useQuery({
    queryKey: ['research', 'studies', 'badges', activeStudyIds],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        activeStudyIds.map(async (id) => {
          try {
            const res = await apiFetch<StudyNotificationsResponse>(`${API_BASE}/${id}/notifications`);
            counts[id] = res.unreadCount;
          } catch {
            counts[id] = 0;
          }
        }),
      );
      return counts;
    },
    enabled: activeStudyIds.length > 0,
    refetchInterval: 60_000,
  });

  // Toast on increment between polls (useRef for prev count).
  useEffect(() => {
    if (!onNewPatients || !badgesQuery.data) return;
    const prev = prevUnreadRef.current;
    for (const [studyId, count] of Object.entries(badgesQuery.data)) {
      const before = prev[studyId] ?? 0;
      if (count > before && before !== 0) {
        const study = query.data?.items.find((s) => s.id === studyId);
        onNewPatients(studyId, study?.name ?? 'Estudio', count - before);
      }
    }
    prevUnreadRef.current = { ...badgesQuery.data };
  }, [badgesQuery.data, onNewPatients, query.data]);

  return { studies: query.data?.items ?? [], ...query, badges: badgesQuery.data ?? {} };
}

export function useStudy(id: string) {
  return useQuery<StudyDTO>({
    queryKey: ['research', 'studies', id],
    queryFn: () => apiFetch<StudyDTO>(`${API_BASE}/${id}`),
    enabled: !!id,
  });
}

export function useStudyNotifications(id: string) {
  return useQuery<StudyNotificationsResponse>({
    queryKey: ['research', 'studies', id, 'notifications'],
    queryFn: () => apiFetch<StudyNotificationsResponse>(`${API_BASE}/${id}/notifications`),
    enabled: !!id,
    refetchInterval: 60_000,
  });
}

export function useStudySuggestions(id: string) {
  return useQuery<{ studyId: string; suggestions: StudySuggestionDTO[] }>({
    queryKey: ['research', 'studies', id, 'suggestions'],
    queryFn: () => apiFetch(`${API_BASE}/${id}/suggestions`),
    enabled: !!id,
  });
}

// Mutations ──────────────────────────────────────
export function useCreateStudy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { queryId: string; name: string; description?: string; publicationRef?: string }) =>
      apiFetch<StudyDTO>(API_BASE, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', 'studies'] }),
  });
}

export function useFreezeStudy(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<StudyDTO>(`${API_BASE}/${id}/freeze`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', 'studies', id] }),
  });
}

export function useArchiveStudy(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<StudyDTO>(`${API_BASE}/${id}/archive`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', 'studies', id] }),
  });
}

export function useReactivateStudy(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<StudyDTO>(`${API_BASE}/${id}/reactivate`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', 'studies', id] }),
  });
}

export function useRecalculateStudy(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<StudyDTO>(`${API_BASE}/${id}/recalculate`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', 'studies', id] }),
  });
}

export function useMarkNotificationsRead(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ markedRead: number }>(`${API_BASE}/${id}/notifications/read`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', 'studies', id, 'notifications'] }),
  });
}

// ─────────────────────────────────────────────
// V3 — Table 1 + Pre/Post (M2/M3)
// ─────────────────────────────────────────────

const BASE = '/v1/research';

export interface TableOneRequest {
  studyId?: string;
  queryId?: string;
  fields: string[];
  groupBy?: string;
  overrides?: Record<string, 'mean_sd' | 'median_iqr'>;
}

export interface TableOneFieldResult {
  field: string;
  n: number;
  representation: 'mean_sd' | 'median_iqr' | 'categorical';
  mean: number | null;
  sd: number | null;
  median: number | null;
  q1: number | null;
  q3: number | null;
  categories: Array<{ label: string; count: number; percent: number }>;
  pValue?: string;
}

export interface TableOneResult {
  queryId: string;
  totalN: number;
  groupBy?: string;
  fields: TableOneFieldResult[];
  warnings: string[];
}

export function useTableOne() {
  return useMutation<TableOneResult, Error, TableOneRequest>({
    mutationFn: (req: TableOneRequest) => apiFetch<TableOneResult>(`${BASE}/table1`, { method: 'POST', body: JSON.stringify(req) }),
  });
}

export function useTableOneCompare() {
  return useMutation<TableOneResult, Error, TableOneRequest>({
    mutationFn: (req: TableOneRequest) => apiFetch<TableOneResult>(`${BASE}/table1/compare`, { method: 'POST', body: JSON.stringify(req) }),
  });
}

export interface PrePostRequest {
  studyId: string;
  scaleType: string;
  surgeryDate?: string;
  preWindowDays?: number;
  postWindowDays?: number;
}

export interface PrePostResult {
  studyId: string;
  scaleType: string;
  n: number;
  pValue: string;
  meanPre: number | null;
  meanPost: number | null;
  meanDifference: number | null;
  percentImprovement: number | null;
  warnings: string[];
}

export function usePrePostAnalysis() {
  return useMutation<PrePostResult, Error, PrePostRequest>({
    mutationFn: (req: PrePostRequest) => apiFetch<PrePostResult>(`${BASE}/analysis/pre-post`, { method: 'POST', body: JSON.stringify(req) }),
  });
}

// ─────────────────────────────────────────────
// V3 — Group comparison (M6) + Survival table (M5)
// ─────────────────────────────────────────────

export interface GroupComparisonRequest {
  studyId?: string;
  queryId?: string;
  groupBy: string;
  variableFields: string[];
}

export interface GroupVariableResult {
  field: string;
  test: 'ttest_independent' | 'mannwhitney' | 'chi_square' | 'fisher_exact' | null;
  pValue: string;
  statistic: number | null;
  groups: Array<{
    key: string;
    n: number;
    representation: 'mean_sd' | 'median_iqr' | 'categorical';
    mean: number | null;
    sd: number | null;
    median: number | null;
    q1: number | null;
    q3: number | null;
    categories: Array<{ label: string; count: number; percent: number }>;
  }>;
  warnings: string[];
}

export interface GroupComparisonResult {
  queryId: string;
  groupBy: string;
  groups: string[];
  variables: GroupVariableResult[];
  warnings: string[];
}

export function useGroupComparison() {
  return useMutation<GroupComparisonResult, Error, GroupComparisonRequest>({
    mutationFn: (req: GroupComparisonRequest) =>
      apiFetch<GroupComparisonResult>(`${BASE}/analysis/compare-groups`, { method: 'POST', body: JSON.stringify(req) }),
  });
}

export interface SurvivalTableRequest {
  studyId?: string;
  queryId?: string;
  timeField: string;
  eventField: string;
  timePoints?: number[];
}

export interface SurvivalTableResult {
  queryId: string;
  timeField: string;
  eventField: string;
  n: number;
  rows: Array<{ months: number; survival: number | null; ciLower: number | null; ciUpper: number | null }>;
  medianSurvival: number | null;
  logRankP: number | null;
  warnings: string[];
  csv: string;
}

export function useSurvivalTable() {
  return useMutation<SurvivalTableResult, Error, SurvivalTableRequest>({
    mutationFn: (req: SurvivalTableRequest) =>
      apiFetch<SurvivalTableResult>(`${BASE}/analysis/survival-table`, { method: 'POST', body: JSON.stringify(req) }),
  });
}

// ─────────────────────────────────────────────
// V3 — Multi-format export (M7)
// ─────────────────────────────────────────────

export type ExportFormat = 'docx' | 'tiff' | 'csv' | 'r_syntax' | 'spss_syntax' | 'zip';

export const EXPORT_FORMAT_LABEL: Record<ExportFormat, string> = {
  docx: 'Word (.docx)',
  tiff: 'Imagen TIFF (300dpi)',
  csv: 'CSV',
  r_syntax: 'Sintaxis R',
  spss_syntax: 'Sintaxis SPSS',
  zip: 'ZIP (todo)',
};

export interface ExportV3Request {
  studyName: string;
  formats: ExportFormat[];
  table1?: unknown;
  comparison?: unknown;
  analyses?: unknown;
  style?: 'APA' | 'Vancouver';
  png?: string;
  csv?: string;
  tests?: unknown;
  testDetails?: unknown;
}

export interface ExportV3JobResult {
  jobId: string;
  format: ExportFormat | 'zip';
  filename: string;
}

export interface ExportV3Status {
  jobId: string;
  status: 'done' | 'failed' | 'unknown';
  filename?: string;
  error?: string;
}

const EXPORT_BASE = '/v1/research/export';

export function useExportV3() {
  return useMutation<ExportV3JobResult, Error, ExportV3Request>({
    mutationFn: (req: ExportV3Request) =>
      apiFetch<ExportV3JobResult>(`${EXPORT_BASE}/v3`, { method: 'POST', body: JSON.stringify(req) }),
  });
}

export function getExportDownloadUrl(jobId: string): string {
  return `${EXPORT_BASE}/v3/${jobId}/download`;
}