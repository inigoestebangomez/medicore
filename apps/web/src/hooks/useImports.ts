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
  matches: PatientMatch[];
  pendingResolutionCount: number;
  autoMatchCount: number;
  newPatientCount: number;
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
  totalRows: number;
  importedRows: number;
  enrichedRows: number;
  createdRows: number;
  skippedRows: number;
  createdAt: string;
  completedAt: string | null;
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
  history: (page: number) => ['imports', 'history', page] as const,
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
    }): Promise<ConfirmImportResponse> => {
      const json = await apiFetch<ApiResponse<ConfirmImportResponse>>(
        `/v1/imports/${input.batchId}/confirm`,
        { method: 'POST', body: JSON.stringify({
          columnMapping: input.columnMapping,
          customFieldNames: input.customFieldNames,
          junkRowIndices: input.junkRowIndices,
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
    queryKey: importKeys.history(page),
    queryFn: async (): Promise<ImportHistoryResponse> => {
      const json = await apiFetch<ApiResponse<ImportHistoryResponse>>(
        `/v1/imports?page=${page}&pageSize=${pageSize}`,
      );
      return json.data;
    },
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
