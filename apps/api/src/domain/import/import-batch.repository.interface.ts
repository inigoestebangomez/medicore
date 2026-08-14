// apps/api/src/domain/import/import-batch.repository.interface.ts
import type { ImportBatch } from './import-batch.entity';
import type {
  ImportStatus,
  ColumnMapping,
  FileSample,
  IgnoredColumn,
  IgnoredRow,
  PreviewOverrides,
  CellOverrides,
} from '@medicore/contracts';

export interface CreateImportBatchInput {
  id: string;
  organizationId: string;
  createdBy: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  originalFormat: 'xlsx' | 'csv' | 'tsv';
  sample: FileSample;
  normalizedRows?: Record<string, unknown>[];
  totalRows: number;
}

export interface UpdateAnalysisInput {
  columnMapping: ColumnMapping;
  customFieldNames?: Record<string, string>;
  junkRowIndices?: number[];
  ignoredColumns?: IgnoredColumn[];
  ignoredRows?: IgnoredRow[];
  previewOverrides?: PreviewOverrides;
  cellOverrides?: CellOverrides;
  aiConfidence?: number | null;
  aiProvider?: 'heuristic' | 'groq' | 'claude' | null;
  issues?: string[];
  notes?: string | null;
  skippedRows?: number;
  pendingRows?: number;
}

export interface UpdateCountersInput {
  importedRows: number;
  enrichedRows: number;
  createdRows: number;
  skippedRows: number;
  pendingRows: number;
}

export interface ListImportBatchesParams {
  organizationId: string;
  page: number;
  pageSize: number;
  status?: ImportStatus;
}

export interface IImportBatchRepository {
  persist(batch: ImportBatch): Promise<ImportBatch>;
  findById(id: string, organizationId: string): Promise<ImportBatch | null>;
  findByOrg(params: ListImportBatchesParams): Promise<{ items: ImportBatch[]; total: number }>;
  updateAnalysis(id: string, organizationId: string, data: UpdateAnalysisInput): Promise<ImportBatch>;
  updateStatus(id: string, organizationId: string, status: ImportStatus, errorMessage?: string | null): Promise<ImportBatch>;
  updateCounters(id: string, organizationId: string, counters: UpdateCountersInput): Promise<ImportBatch>;
  softDelete(id: string, organizationId: string): Promise<ImportBatch>;
  findLatestByOrg(organizationId: string): Promise<ImportBatch | null>;
}
