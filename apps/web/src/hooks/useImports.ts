// apps/web/src/hooks/useImports.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-fetch';
import type {
  ColumnMapping,
  ColumnMappingProposal,
  FileSample,
  ImportStatus,
  MatchDecision,
  PatientMatch,
  CellOverrides,
  IgnoredColumn,
  IgnoredRow,
  PreviewOverrides,
  RowClassification,
} from '@medicore/contracts';

// ─────────────────────────────────────────────
// Response shapes (mirror the API DTOs)
// ─────────────────────────────────────────────

export interface ParseFileResponse {
  batchId: string;
  fileName: string;
  originalFormat: 'xlsx' | 'csv' | 'tsv';
  totalRows: number;
  fileHash: string;
  sample: FileSample;
  proposal: ColumnMappingProposal;
  provider: string;
}

export interface AnalyzeColumnsResponse {
  batchId: string;
  proposal: ColumnMappingProposal;
  provider: string;
  metThreshold: boolean;
}

export interface ConfirmImportResponse {
  batchId: string;
  totalRows: number;
  cleanedRowCount: number;
  junkRowCount: number;
  skippedRowCount: number;
  discardedRowCount: number;
  matches: PatientMatch[];
  pendingResolutionCount: number;
  autoMatchCount: number;
  newPatientCount: number;
  fullIdentityRows: RowClassification[];
  identityLightRows: RowClassification[];
  unidentifiableRows: RowClassification[];
  fullIdentityCount: number;
  identityLightCount: number;
  unidentifiableCount: number;
}

export interface FinalizeImportResponse {
  batchId: string;
  status: ImportStatus;
  message: string;
}

export interface RevertImportResponse {
  batchId: string;
  reverted: boolean;
  affectedPatients: number;
}

export interface ImportBatchListItem {
  id: string;
  fileName: string;
  originalFormat: string;
  status: ImportStatus;
  errorMessage: string | null;
  totalRows: number;
  importedRows: number;
  enrichedRows: number;
  createdRows: number;
  skippedRows: number;
  discardedRowCount?: number;
  createdAt: string;
  completedAt: string | null;
}

export interface ImportBatchDetail extends ImportBatchListItem {
  sample: FileSample;
  columnMapping: ColumnMapping;
  customFieldNames?: Record<string, string>;
  junkRowIndices?: number[];
  ignoredColumns?: IgnoredColumn[];
  ignoredRows?: IgnoredRow[];
  previewOverrides?: PreviewOverrides;
  cellOverrides?: CellOverrides;
  aiConfidence?: number | null;
  aiProvider?: string | null;
  issues?: string[];
  notes?: string | null;
  pendingRows: number;
  normalizedRowsAvailable?: boolean;
}

export interface ImportPreviewResponse {
  batchId: string;
  columns: string[];
  rows: Array<{ rowIndex: number; values: Record<string, unknown> }>;
  totalRows: number;
  page: number;
  pageSize: number;
  source: 'cache' | 'persisted';
}

export interface ImportHistoryResponse {
  items: ImportBatchListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReminderStatusResponse {
  organizationId: string;
  daysSinceLastImport: number | null;
  reminderDays: number;
  showBanner: boolean;
  disabled: boolean;
  lastImportAt: string | null;
}

// The API wraps responses in { data: ... }; unwrap via apiFetch typing.
interface ApiResponse<T> { data: T }

// ─────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────

const importKeys = {
  all: ['imports'] as const,
  history: (page: number, pageSize: number) => ['imports', 'history', page, pageSize] as const,
  reminder: () => ['imports', 'reminder'] as const,
  detail: (id: string) => ['imports', 'detail', id] as const,
};

export function useParseImportFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<ParseFileResponse> => {
      const form = new FormData();
      form.append('file', file);
      // apiFetch sets JSON content-type by default; for multipart we omit it so
      // the browser sets the multipart boundary.
      const res = await fetch('/v1/imports/upload', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message ?? `Upload failed: ${res.status}`);
      }
      const json: ApiResponse<ParseFileResponse> = await res.json();
      return json.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: importKeys.all }),
  });
}

export function useReanalyzeImport() {
  return useMutation({
    mutationFn: async (batchId: string): Promise<AnalyzeColumnsResponse> => {
      const json = await apiFetch<ApiResponse<AnalyzeColumnsResponse>>(
        `/v1/imports/${batchId}/reanalyze`,
        { method: 'POST' },
      );
      return json.data;
    },
  });
}

export function useConfirmImportMapping() {
  return useMutation({
    mutationFn: async (input: {
      batchId: string;
      columnMapping: ColumnMapping;
      customFieldNames?: Record<string, string>;
      junkRowIndices?: number[];
      previewOverrides?: PreviewOverrides;
      ignoredColumns?: IgnoredColumn[];
      ignoredRows?: IgnoredRow[];
      cellOverrides?: CellOverrides;
    }): Promise<ConfirmImportResponse> => {
      const json = await apiFetch<ApiResponse<ConfirmImportResponse>>(
        `/v1/imports/${input.batchId}/confirm`,
        { method: 'POST', body: JSON.stringify({
          columnMapping: input.columnMapping,
          customFieldNames: input.customFieldNames,
          junkRowIndices: input.junkRowIndices,
          previewOverrides: input.previewOverrides,
          ignoredColumns: input.ignoredColumns,
          ignoredRows: input.ignoredRows,
          cellOverrides: input.cellOverrides,
        }) },
      );
      return json.data;
    },
  });
}

export function useFinalizeImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      batchId: string;
      matchResolutions?: Record<string, MatchDecision>;
    }): Promise<FinalizeImportResponse> => {
      const json = await apiFetch<ApiResponse<FinalizeImportResponse>>(
        `/v1/imports/${input.batchId}/finalize`,
        { method: 'POST', body: JSON.stringify({ matchResolutions: input.matchResolutions ?? {} }) },
      );
      return json.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: importKeys.all }),
  });
}

export function useRevertImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (batchId: string): Promise<RevertImportResponse> => {
      const json = await apiFetch<ApiResponse<RevertImportResponse>>(
        `/v1/imports/${batchId}/revert`,
        { method: 'POST' },
      );
      return json.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: importKeys.all }),
  });
}

// ─────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────

export function useImportHistory(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: importKeys.history(page, pageSize),
    queryFn: async (): Promise<ImportHistoryResponse> => {
      const json = await apiFetch<ApiResponse<ImportHistoryResponse>>(
        `/v1/imports?page=${page}&pageSize=${pageSize}`,
      );
      return json.data;
    },
  });
}

const TERMINAL_IMPORT_STATUSES: ReadonlySet<ImportStatus> = new Set(['COMPLETED', 'FAILED']);

export function useImportBatch(batchId: string | null) {
  return useQuery({
    queryKey: importKeys.detail(batchId ?? ''),
    enabled: Boolean(batchId),
    queryFn: async (): Promise<ImportBatchDetail> => {
      if (!batchId) throw new Error('batchId is required');
      const json = await apiFetch<ApiResponse<ImportBatchDetail>>(`/v1/imports/${batchId}`);
      return json.data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && !TERMINAL_IMPORT_STATUSES.has(status) ? 2000 : false;
    },
    refetchIntervalInBackground: true,
  });
}

export function useImportPreview(batchId: string | null, page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ['imports', 'preview', batchId ?? '', page, pageSize],
    enabled: Boolean(batchId),
    queryFn: async (): Promise<ImportPreviewResponse> => {
      if (!batchId) throw new Error('batchId is required');
      const json = await apiFetch<ApiResponse<ImportPreviewResponse>>(
        `/v1/imports/${batchId}/preview?page=${page}&pageSize=${pageSize}`,
      );
      return json.data;
    },
    placeholderData: (previous) => previous,
  });
}

export function useImportReminder() {
  return useQuery({
    queryKey: importKeys.reminder(),
    queryFn: async (): Promise<ReminderStatusResponse> => {
      const json = await apiFetch<ApiResponse<ReminderStatusResponse>>('/v1/imports/reminder');
      return json.data;
    },
  });
}
